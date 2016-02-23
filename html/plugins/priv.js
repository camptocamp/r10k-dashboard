dashboard.priv = function(name) {
  var repo = repositories[name].github.repo_obj.info;
  var html = repo.private ? '<i class="fa fa-lock"></i>' : '';
  var customkey = repo.private ? '1' : '0';
  updateCell(name, 'priv', html, null, customkey);
}
