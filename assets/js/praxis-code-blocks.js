// Docsy creates the copy control inside the scrolling pre. Move it beside the
// pre so one-line blocks stay compact and long lines cannot run beneath it.
for (const control of document.querySelectorAll('.td-content .highlight > pre > .click-to-copy')) {
  control.parentElement.parentElement.append(control);
}
