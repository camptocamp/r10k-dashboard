dashboard.last_committer = function(repo) {
  var r = repositories[repo.name]['repo'];
  r.getCommits(null, function(err, commits) {
    var commit = commits[0];

    var html = '';
    var status = 'unknown';

    if (commit.author) {
      var avatar = '<img src="'+commit.author.avatar_url+'" width="30px" />';
      html = '<a href="'+commit.author.html_url+'">'+avatar+'</a>';
    }

    updateCell(repo.name, 'last_committer', html, status);
  });
}
