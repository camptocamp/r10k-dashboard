dashboard.latest_version = function(name, repo) {
  var r = repositories[name];
  console.log(r.forge);
  var url = '';
  var version = r.forge.current_release.version;
  var html = '<a href="'+url+'">'+version+'</a>';
  updateCell(name, 'latest_version', html);
}
