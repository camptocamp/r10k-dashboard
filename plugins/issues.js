dashboard.issues = function(name) {
  r = repositories[name];
  github.getIssues(r.github.user, r.github.repo).list(null, function(err, issues) {
    var status;
    var text;
    var title;
    var customkey = 0;
    if (err) {
      title = JSON.parse(err.request.response).message;
      if (err.error == 410) {
        text = 'N/A';
        status = 'ok';
      } else {
        text = 'ERR';
        status = 'warn';
      }
    } else {
            console.log(issues);
      var l = 0;
      for (var i=0; i < issues.length; i++) {
        if (! issues[i].pull_request) {
          console.log(i+' is not a pull request');
          l++;
        }
      }
      text = l;
      title = l+' open issues';
      customkey = l;
      if (l > 0) {
        status = 'warn';
      } else {
        status = 'ok';
      }
    }
    html = '<a href="https://github.com/'+account+'/'+name+'/issues" title="'+title+'">'+text+'</a>';
    updateCell(name, 'issues', html, status, customkey);
  });
}

