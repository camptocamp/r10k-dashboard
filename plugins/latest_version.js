dashboard.latest_version = function(name, repo) {
  var r = repositories[name];
  var html;
  
  if (r.forge) {
    var version = r.forge.current_release.version;
    var version_url = 'https://forge.puppetlabs.com/'+r.forge.current_release.module.owner.username+'/'+r.forge.name+'/'+version;
    html = '<a href="'+version_url+'">'+version+'</a>';
    if (r.info.version === version) {
      // All OK
      updateCell(name, 'latest_version', html);
    } else {
      // compare with github/tags
      r.repo.listTags(function(err, tags) {
        if (err) {
          html += ' <a href="'+r.info.tags_url+'" title="Failed to get tags"><i class="fa fa-warning"></i></a>';
          updateCell(name, 'latest_version', html);
        } else {
          var base_ref;
          if (r.info.ref) {
            // Use ref as base
            base_ref = r.info.ref;
          } else {
            base_ref_tag = versionTagURL(tags, r.info.version);
            if (base_ref_tag) {
              base_ref = base_ref_tag.tag;
            } else {
              // No tag found, it's a warning
              html += ' <a href="'+r.info.tags_url+'" title="No matching tag '+r.info.version+' found in repository"><i class="fa fa-warning"></i></a>';
              updateCell(name, 'latest_version', html, 'warn', '2');
            }
          }
          var version_tag = versionTagURL(tags, version);
          if (version_tag) {
            var html = '<a href="'+version_url+'">'+version+'</a>';
            html += ' <a href="'+version_tag.url+'" title="Matching tag found in repository"><i class="fa fa-tag"></i></a>';
            checkForgeCommits(name, r, version, version_url, version_tag.tag, r.github.user, base_ref, html);
          } else {
            // No tag found, it's a warning
            html += ' <a href="'+r.info.tags_url+'" title="No matching tag '+version+' found in repository"><i class="fa fa-warning"></i></a>';
            updateCell(name, 'latest_version', html, 'warn', '2');
          }
        }
      });
    }
  } else {
    // Nothing on forge, compare with account/master
    var version = 'master';
    var version_url = r.github.uri;
    html = '<a href="'+version_url+'">'+version+'</a>';
    checkForgeCommits(name, r, version, version_url, 'master', r.github.user, r.info.ref, html);
  }
}

function checkForgeCommits(name, tags_r, version, url, base_version, ref_user, b, html) {
  var state;
  var customkey;

  // get diff
  tags_r.repo.compare(tags_r.github.user+':'+base_version, ref_user+':'+b, function(err, diff) {
    if (err) {
      html += ' <span title="Failed to get commits since tag"><i class="fa fa-warning"></i></span>';
      updateCell(name, 'latest_version', 'status', html, 'err', '15');
    } else {
      if (diff.status == 'ahead') {
        diff_url = diff.html_url;
        html += ' <a href="'+diff_url+'" title="Branch '+b+' is '+diff.ahead_by+' commits ahead of tag '+version+'"><i class="fa fa-angle-double-up"></i></a>';
        state = 'warn';
        customkey = '11';
      } else if (diff.status == 'behind') {
        // /!\ using invertDiffURL from status plugin
        diff_url = invertDiffURL(diff.html_url);
        html += ' <a href="'+diff_url+'" title="Branch '+b+' is '+diff.behind_by+' commits behind of tag '+version+'"><i class="fa fa-angle-double-down"></i></a>';
        state = 'warn';
        customkey = '12';
      } else if (diff.status == 'diverged') {
        diff_url = diff.html_url;
        html += ' <a href="'+diff_url+'" title="Branch '+b+' is '+diff.behind_by+' commits behind and '+diff.ahead_by+' commits ahead of tag '+version+'"><i class="fa fa-code-fork"></i></a>';
      } else if (diff.status == 'identical') {
        html += ' <span title="Branch '+b+' is identical to tag '+version+'"><i class="fa fa-check"></i></span>';
        state = 'ok';
        customkey = '13';
      } else {
        html += ' <span title="Branch '+b+' has comparison status with tag '+version+' set to '+diff.status+'"><i class="fa fa-warning"></i></span>';
        state = 'unknown';
        customkey = '14';
      }
    }
    updateCell(name, 'latest_version', html, state, customkey);
  });
}

function versionTagURL(tags, version) {
  for (var i=0; i<tags.length; i++) {
    if (tags[i].name === version || tags[i].name === 'v'+version) {
      return { 'url': tags[i].commit.url, 'tag': tags[i].name };
    }
  }
}

function invertDiffURL(url) {
  var base = url.match(/\/([^/]+)\.\.\./);
  return url.replace(base[0], '/')+'...'+base[1];
}
