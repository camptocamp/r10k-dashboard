dashboard.issues = function(name) {
  listIssues(name, 'issues', false);
}

function listIssues(name, plugin, incl_pulls) {
  var r = repositories[name];

  if (r.github.user !== account) {
    // Only relevant if it's our own module
    updateCell(name, plugin, 'N/A', 'ok', '-1');
    return;
  }

  var issue = github.getIssues(r.github.user, r.github.repo);
  issue.list(null, function(err, issues) {
    var status;
    var text;
    var customkey = 0;
    if (err) {
      var title = JSON.parse(err.request.response).message;
      if (err.error == 410) {
        text = 'N/A';
        status = 'ok';
      } else {
        text = 'ERR';
        status = 'warn';
      }
      updateIssueCell(name, plugin, r, title, text, status, customkey);
    } else {
      // Get issues comments
      console.log(plugin+": getting comments");
      issue.comments(null, function(err, comments) {
        var t = 0;
        console.log(plugin+": getting collabs");
        repoCollaborators(r.repo, function(collabs) {
          var l = 0;
          var title = 'No actions needed';
          for (var i=0; i < issues.length; i++) {
            var issue = issues[i];
            // Check if we include pull requests
            if (!!issue.pull_request === incl_pulls) {
              t++;
              // Check if issue was updated
                issue_status = issueStatus(issue, comments, collabs);
                switch(issue_status.status) {
                  case 'new_comments':
                    l++;
                    title += issue_status.message+"\n";
                    break;
                  case 'no_comments':
                    l++;
                    title += issue_status.message+"\n";
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
          console.log(plugin+": updating cell");
          updateIssueCell(name, plugin, r, title, text, status, customkey);
        });
      });
    }
  });
}

function updateIssueCell(name, plugin, r, title, text, status, customkey) {
  html = '<a href="'+r.github.repo_obj.info.html_url+'/'+plugin+'" title="'+title+'">'+text+'</a>';
  updateCell(name, plugin, html, status, customkey);
}

function issueStatus(issue, comments, collabs) {
  console.log("Checking status for issue "+issue.number);
  // Newer comments are at the end of the list
  for (var i=comments.length-1; i >= 0; i--) {
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
        'message': 'New comment by '+comments[i].user.login+' on issue '+issue.number
      };
    }
  }
  // No comments found
  return {
    'status': 'no_comments',
    'message': 'No comments on issue '+issue.number
  };
}
