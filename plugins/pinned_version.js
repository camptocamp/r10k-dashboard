dashboard.pinned_version = function(name, repo) {
  var info = repositories[name].info;
  var version;
  var url;
  if (info.ref) {
    version = info.ref;
    if (/^[a-z0-9]+$/.test(version)) {
      // Assume commit
      url = info.git+'/commit/'+version;
    } else {
      // Assume tag (or branch?)
      url = info.git+'/releases/tag/'+version;
    }
  } else {
    version = info.version;
    url = 'https://forge.puppetlabs.com/'+info.forge.current_release.module.owner.username+'/'+info.forge.name;
  }
  var html = '<a href="'+url+'">'+version+'</a>';
  updateCell(name, 'pinned_version', html);
}
