dashboard.pinned_version = function(name, repo) {
  var info = repositories[name].info;
  var version;
  if (info.ref) {
    var version = info.ref;
  } else {
    var version = info.version;
  }
  updateCell(name, 'pinned_version', version);
}
