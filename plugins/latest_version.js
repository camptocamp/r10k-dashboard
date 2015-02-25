dashboard.latest_version = function(name, repo) {
  var r = repositories[name];
  var html;
  if (r.forge) {
    version = r.forge.current_release.version;
    url = 'https://forge.puppetlabs.com/'+r.forge.current_release.module.owner.username+'/'+r.forge.name+'/'+version;
    html = '<a href="'+url+'">'+version+'</a>';
  } else {
    html = 'N/A';
  }
  updateCell(name, 'latest_version', html);
}
