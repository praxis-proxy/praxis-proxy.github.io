#!/usr/bin/env python3
"""Static browser-QA server with gzip, matching normal production text delivery."""
import argparse
import gzip
import io
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = Path(self.translate_path(self.path))
        if path.is_dir():
            path = path / 'index.html'
        if (path.is_file() and path.suffix in {'.html', '.css', '.js', '.json', '.svg', '.xml'}
                and 'gzip' in self.headers.get('Accept-Encoding', '')):
            data = gzip.compress(path.read_bytes(), compresslevel=6)
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(str(path)))
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Vary', 'Accept-Encoding')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            return io.BytesIO(data)
        return super().send_head()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=18132)
    parser.add_argument('--directory', default=str(Path(__file__).resolve().parents[1] / 'public'))
    args = parser.parse_args()
    ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=args.directory)).serve_forever()
