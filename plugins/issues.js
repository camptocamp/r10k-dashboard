dashboard.issues = function(name) {
  r = repositories[name];

  if (r.github.user !== account) {
    // Only relevant if it's our own module
    updateCell(name, 'issues', 'N/A');
    return;
  }

  var issue = github.getIssues(r.github.user, r.github.repo);
  issue.list(null, function(err, issues) {
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
      updateIssueCell(name, r, title, text, status, customkey);
    } else {
      // Get issues comments
      issue.comments(null, function(err, comments) {
        var l = 0;
        var t = 0;
        repoCollaborators(r.repo, function(collabs) {
          var title = '';
          for (var i=0; i < issues.length; i++) {
            var issue = issues[i];
            if (! issue.pull_request) {
              t++;
              console.log(issue.number+' is not a pull request');
              // Check if issue was updated
                issue_status = issueStatus(issue, comments, collabs);
                switch(issue_status.status) {
                  case 'new_comments':
                    l++;
                    title += issue_status.message+"\n";
                    break;
                  case 'no_comments':
                    l++;
                    break;
                }
            }
          }
          var text = l+'/'+t;
          var customkey = l;
          if (l > 0) {
            status = 'warn';
          } else {
            status = 'ok';
          }
          updateIssueCell(name, r, title, text, status, customkey);
        });
      });
    }
  });
}

function updateIssueCell(name, r, title, text, status, customkey) {
  html = '<a href="'+r.github.repo_obj.info.html_url+'/issues" title="'+title+'">'+text+'</a>';
  updateCell(name, 'issues', html, status, customkey);
}

function issueStatus(issue, comments, collabs) {
  for (var i=0; i < comments.length; i++) {
    if (comments[i].issue_url === issue.url) {
      // Most recent event for issue
      for (var j=0; j < collabs.length; j++) {
        if (comments[i].user.login === collabs[j].login ) {
          return {
            'status': 'no_new_comments',
            'message': 'issue '+issue.number+' was last commented by '+comments[i].user.login
          };
        }
      }
      // Comment is not by a collaborator
      return {
        'status': 'new_comments',
        'message': 'New comment by '+comments[j].user.login+' on issue '+issue.number
      };
    }
  }
  // No comments found
  return {
    'status': 'no_comments',
    'message': 'No comments on issue '+issue.number
  };
}
