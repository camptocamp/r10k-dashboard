dashboard.endorsement = function(name, repo) {
  var html;
  if (repositories[name].forge) {
    html = repositories[name].forge.endorsement;
  } else {
    html = '';
  }
  updateCell(name, 'endorsement', html);
}
