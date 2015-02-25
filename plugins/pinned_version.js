dashboard.pinned_version = function(name, repo) {
  var r = repositories[name];
  var version;
  var url;
  if (info.ref) {
    version = r.info.ref;
    if (/^[a-z0-9]+$/.test(version)) {
      // Assume commit
      url = r.info.git+'/tree/'+version;
    } else {
      // Assume tag (or branch?)
      url = r.info.git+'/releases/tag/'+version;
    }
  } else {
    version = r.info.version;
    url = 'https://forge.puppetlabs.com/'+r.forge.current_release.module.owner.username+'/'+r.forge.name+'/'+version;
  }
  var html = '<a href="'+url+'">'+version+'</a>';
  updateCell(name, 'pinned_version', html);
}
