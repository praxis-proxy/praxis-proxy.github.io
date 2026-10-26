#!/usr/bin/env python3
"""Check the first proxy tutorial with a selected-release binary or image."""
import argparse
import json
import re
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def request(url):
    with urllib.request.urlopen(url, timeout=2) as response:
        return response.status, response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    runtime = parser.add_mutually_exclusive_group(required=True)
    runtime.add_argument('--binary', type=Path)
    runtime.add_argument('--image', help='Selected official container image')
    args = parser.parse_args()
    binary = str(args.binary.resolve()) if args.binary else None
    version_command = [binary] if binary else ['docker', 'run', '--rm', args.image]
    version = subprocess.check_output(version_command + ['--version'], text=True).strip()
    assert version.startswith('praxis 0.7.2'), f'Expected selected v0.7.2, got {version}'
    tutorial = (ROOT / 'content/guides/first-proxy.md').read_text()
    config = re.search(r'```yaml\n(.*?)\n```', tutorial, re.S).group(1) + '\n'
    with tempfile.TemporaryDirectory(prefix='praxis-tutorial-') as directory:
        work = Path(directory)
        config_path = work / 'praxis.yaml'
        config_path.write_text(config)
        network = work.name
        echo_container = f'{network}-echo'
        proxy_container = f'{network}-proxy'

        def command(path):
            if binary:
                return [binary, '--config', str(path)]
            return ['docker', 'run', '--rm', '--name', proxy_container,
                    '--network', network, '--publish', '127.0.0.1:8080:8080',
                    '--mount', f'type=bind,source={path},target=/etc/praxis/config.yaml,readonly', args.image]

        endpoint = re.compile(r'("?)praxis-echo:3000("?)')
        assert endpoint.search(config), 'Tutorial config must point to praxis-echo:3000'
        if binary:
            config = endpoint.sub(r'\g<1>127.0.0.1:3000\g<2>', config)
        config_path.write_text(config)

        processes = []
        try:
            subprocess.run(['docker', 'network', 'create', network], check=True,
                           stdout=subprocess.DEVNULL)
            subprocess.run(['docker', 'run', '--detach', '--name', echo_container,
                            '--network', network, '--network-alias', 'praxis-echo',
                            '--publish', '127.0.0.1:3000:3000',
                            'registry.k8s.io/gateway-api/conformance/echo-basic:v0.1.0'],
                           check=True, stdout=subprocess.DEVNULL)

            if binary:
                validate = command(config_path) + ['--validate']
            else:
                validate = ['docker', 'run', '--rm', '--network', network,
                            '--mount', f'type=bind,source={config_path},target=/etc/praxis/config.yaml,readonly',
                            args.image, '--validate']
            subprocess.run(validate, check=True)

            assert re.search(r'(?m)^\s+allow_private_upstreams: true\s*$', config), (
                'Tutorial must enable runtime private-upstream access for the Docker echo service'
            )

            with (work / 'servers.log').open('w+') as log:
                processes.append(subprocess.Popen(command(config_path), stdout=log, stderr=log))
                for _ in range(50):
                    if any(p.poll() is not None for p in processes):
                        log.flush()
                        raise AssertionError('Tutorial server exited: ' + (work / 'servers.log').read_text())
                    try:
                        status, body = request('http://127.0.0.1:8080/')
                        break
                    except OSError:
                        time.sleep(0.1)
                else:
                    raise AssertionError('Proxy did not become ready')
                response = json.loads(body)
                assert status == 200 and response.get('method') == 'GET' and response.get('path') == '/', (status, response)
                backend_status, backend_body = request('http://127.0.0.1:3000/')
                backend_response = json.loads(backend_body)
                assert backend_status == 200 and backend_response.get('method') == 'GET' and backend_response.get('path') == '/', (backend_status, backend_response)
                print(f'Onboarding passed: {version}; validation, runtime private-upstream opt-in, and forwarded HTTP 200/body')
        finally:
            if args.image:
                subprocess.run(['docker', 'rm', '--force', proxy_container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(['docker', 'rm', '--force', echo_container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            subprocess.run(['docker', 'network', 'rm', network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for process in processes:
                process.terminate()
            for process in processes:
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == '__main__':
    main()
