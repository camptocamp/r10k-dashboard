dashboard.pulls = function(name) {
  var r = repositories[name];

  if (r.github.user !== account) {
    // Only relevant if it's our own module
    updateCell(name, 'pulls', 'N/A');
    return;
  }

  r.github.repo_obj.listPulls('open', function(err, pulls) {
    var status;
    var customkey = 0;
    html = '<a href="'+r.github.repo_obj.info.html_url+'/pulls">'+pulls.length+'</a>';
    if (pulls.length > 0) {
      status = 'warn';
      customkey = pulls.length;
    } else {
      status = 'ok';
    }
    updateCell(name, 'pulls', html, status, customkey);
  });
}
