dashboard.pinned_version = function(name) {
  var r = repositories[name];
  var version;
  var url;
  var html;
  var state = 'ok';
  if (r.info.ref) {
    version = r.info.ref;
    if (/^[a-z0-9]+$/.test(version)) {
      // Assume commit
      url = r.info.git+'/tree/'+version;
    } else {
      // Assume tag (or branch?)
      url = r.info.git+'/releases/tag/'+version;
    }
    html = '<a href="'+url+'">'+version+'</a>';
  } else if (r.info.version) {
    version = r.info.version;
    url = 'https://forge.puppetlabs.com/'+r.forge.current_release.module.owner.username+'/'+r.forge.name+'/'+version;
    html = '<a href="'+url+'">'+version+'</a>';
  } else {
    html = 'N/A <i class="fa fa-warning" title="No pin set"></i>';
    state = 'warning';
  }
  updateCell(name, 'pinned_version', html, state);
}
