/* Main */

import { Octokit } from "https://cdn.skypack.dev/@octokit/rest";

var dashboard = new Object();
var cookies = new Object();
var sortTimeout;
var repositories;
var gh_user;
var octokit;
var token;
var account;
var r10k_repo;
var refresh;
var refresh_randomize;
var repoHeads;
var plugin_options;

  export function updateCell(repo, cell, value, state, customkey) {
    var repoLine = document.getElementById(repo);
    var cell = repoLine.getElementsByClassName('plugin:'+cell)[0];
    cell.innerHTML = value;
    if (state) {
      var classes = cell.className.replace(/unknown|err|warn|ok/, '');
      cell.className = classes+' '+state;
    }
    if (typeof customkey !== 'undefined') {
      cell.setAttribute('sorttable_customkey', customkey);
    }
    computeState(repoLine, state);
    refreshSortTimeout();
  }

  function computeState(line, newState, force) {
    var oldState = 'unknown';
    var classes = line.className.split(' ');
    var state;
    var cells = line.getElementsByTagName('td');
    var refreshCell = cells[cells.length-1];
    var stateWeight = parseInt(refreshCell.getAttribute('sorttable_customkey')) || 0;
    if (classes.length > 0) {
      for (var i=0; i<classes.length; i++) {
        if (classes[i].match(/unknown|err|warn|ok/)) {
          oldState = classes[i];
          classes.splice(i, 1);
          break;
        }
      }
      if (force) {
        state = newState;
        stateWeight = stateToNum(newState);
      } else {
        state = worstState(oldState, newState);
        stateWeight += stateToNum(newState);
      }
      classes.push(state);
      line.className = classes.join(' ');
    } else {
      state = newState;
      line.className = newState;
    }
    // Use the refresh column to sort by state
    refreshCell.setAttribute('sorttable_customkey', stateWeight);
    refreshCell.getElementsByTagName('i')[0].setAttribute('title', 'score: '+stateWeight);
    refreshTotalScore();
  }

  // TODO: give a numerical weight to each line
  function stateToNum(state) {
    switch (state) {
      case 'err':
        return 1000;
      case 'warn':
        return 100;
      case 'ok':
        return 0;
      default:
        return 10;
    }
  }

  function worstState(oldState, newState) {
    switch (newState) {
      case 'err':
        return 'err';
      case 'warn':
        if (oldState != 'err') return 'warn';
      case 'ok':
        if (oldState != 'err' && oldState != 'warn') return 'ok';
      default:
        return oldState;
    }
  }

  function refreshSort() {
    var reposTable = document.getElementById('repositories');
    var heads = reposTable.getElementsByTagName('th');
    for (var i=0; i<heads.length; i++) {
      if (heads[i].className.match(/\bsorttable_([a-z0-9]+)_reverse\b/)) {
        // first sort by name
        sorttable.innerSortFunction.apply(heads[0], []);
        // sort twice to reverse
        sorttable.innerSortFunction.apply(heads[i], []);
        sorttable.innerSortFunction.apply(heads[i], []);
        break;
      } else if (heads[i].className.match(/\bsorttable_sorted([a-z0-9]*)\b/)) {
        // first sort by name
        sorttable.innerSortFunction.apply(heads[0], []);
        sorttable.innerSortFunction.apply(heads[i], []);
        break;
      }
    }
  }

  // Cookies
  
  function createCookie(name,value,days) {
    if (days) {
      var date = new Date();
      date.setTime(date.getTime()+(days*24*60*60*1000));
      var expires = "; expires="+date.toGMTString();
    }
    else var expires = "";
    document.cookie = name+"="+value+expires+"; path=/";
  }

  function readCookie(name) {
    var value = cookies[name];
    if (value) {
      return value;
    } else {
      var nameEQ = name + "=";
      var ca = document.cookie.split(';');
      for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) {
          value = c.substring(nameEQ.length,c.length);
          cookies[name] = value;
          return value;
        }
      }
    }
    return null;
  }

  function eraseCookie(name) {
    createCookie(name,"",-1);
  }
  
  function dispError(err) {
    var reposTable = document.getElementById('repositories');
    var reposTableBody = document.getElementsByTagName('tbody')[0];
    var errElem = document.createElement('tr');
    errElem.setAttribute('id', 'error');
    errElem.innerHTML = '<td colspan="'+(repoHeads.length+2)+'">'+err+'</td>';
    reposTableBody.appendChild(errElem);
  }

  function refreshSortTimeout () {
    clearTimeout(sortTimeout);
    sortTimeout = setTimeout(function() {refreshSort()}, 500);
  }
  
  
  function refreshTotalScore() {
    var totalScore = 0;
    var reposTable = document.getElementById('repositories');
    var reposLines = document.getElementsByTagName('tr');
    // Ignore title line
    for (var i=1; i<reposLines.length; i++) {
      var cells = reposLines[i].getElementsByTagName('td');
      var scoreCell = cells[cells.length-1];
      var score = parseInt(scoreCell.getAttribute('sorttable_customkey')) || 0;
      totalScore += score;
    }
  
    var totalScoreElem = document.getElementById('total_score');
    totalScoreElem.innerHTML = 'Total score: '+totalScore;
  }

  function parsePuppetfile(contents) {
    // Split each entry by newline, unless preceded by a comma
    var entries = atob(contents.content).match(/[^\n][\s\S]+?[^,](?=\s*\n\s*)/g);
    var mods = new Array();
    for (var i=0; i<entries.length; i++) {
      if (/^mod\s/.test(entries[i])) {
        var parts = entries[i].split(/\s*,\s*\n*\s*/);
        var name_parts = parts[0].match(/mod\s+'(?:(\w+)[\/-])?(\w+)'/)
        var user = name_parts[1];
        var name = name_parts[2];
        var mod = {
          'name': name,
          'user': user
        }
        if (/^'\d+\.\d+\.\d+'$/.test(parts[1])) {
          // Version number
          mod.version = parts[1].replace(/'/g, '');
        } else {
          for (var j=1; j<parts.length; j++) {
            var param_parts = parts[j].split(/\s*=>\s*/);
            mod[param_parts[0].replace(':', '')] = param_parts[1].replace(/'/g, '');
          }
        }
        mods.push(mod);
      }
    }
    return mods;
  }

  function forgeAPICall(path, cb) {
    var url = 'https://forgeapi.puppetlabs.com/v3'+escape(path);
    var xhr = new XMLHttpRequest();

    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (this.readyState == 4) {
        if (this.status >= 200 && this.status < 300 || this.status === 304) {
          cb(null, this.responseText ? JSON.parse(this.responseText) : true, this);
        } else {
          cb({path: path, request: this, error: this.status});
        }
      }
    };
    xhr.setRequestHeader('X-Referer',location.href);
    xhr.setRequestHeader('Content-Type','application/json;charset=UTF-8');
    xhr.onerror = function() {
    };
    xhr.send();
  };
    
  function updateRepo(name) {
    forgeAPICall('/modules/'+repositories[name]['info']['user']+'-'+repositories[name]['info']['name'], function(err, res) {
      repositories[name]['forge'] = res;
      updateRepoWithGH(name);
    });
  }

  function updateRepoWithGH(name) {
    repositories[name]['github'] = { }
    if (repositories[name]['info']['git']) {
      repositories[name]['github'].uri = repositories[name]['info']['git'];
    } else if (repositories[name].forge.current_release.metadata.source !== 'UNKNOWN') {
      // Try to get from forge
      repositories[name]['github'].uri = repositories[name].forge.current_release.metadata.source;
    } else {
      // Try with the homepage from forge
      repositories[name]['github'].uri = repositories[name].forge.homepage_url;
    }

    var matches = repositories[name].github.uri.match(/\/([^\/]+)\/([^\/\.]+)(\.git)?$/);
    repositories[name].github.user = matches[1];
    repositories[name].github.repo = matches[2];

    // Update left column
    if (repositories[name].forge) {
      document.getElementById(name).getElementsByTagName('a')[0].href = repositories[name].forge.homepage_url;
    } else {
      document.getElementById(name).getElementsByTagName('a')[0].href = repositories[name].github.uri;
    }

    var r = octokit.rest.repos.get({
      owner: repositories[name].github.user,
      repo: repositories[name].github.repo
    }).then((data) => {
      repositories[name]['repo'] = r;
      var repoLine = document.getElementById(name);
      computeState(repoLine, 'unknown', true);

      console.log(data);
      repositories[name].github.repo_obj = r;
      repositories[name].github.repo_obj.info = data.data;
      // refresh all cells
      for (var i=0; i<repoHeads.length; i++) {
        var plugin = repoHeads[i].replace('plugin:', '');
        dashboard[plugin](name);
      }
    });
  
    // auto-refresh
    if (refresh > 0) {
      var refresh_time = refresh + Math.random()*refresh*refresh_randomize;
      setTimeout(function() {updateRepo(name)}, refresh_time);
    }
  }

  function listRepos(repos, refresh) {
    var spinner = document.getElementById('spinner');
    var reposTable = document.getElementById('repositories');
    var reposTableBody = document.getElementsByTagName('tbody')[0];
  
    spinner.style.display = 'none';
  
    // Filter repos
    var filtered_repos = [];
    for (var i=0; i<repos.length; i++) {
      var name = repos[i].name;
      /*
      if (filter) {
        filterReg = new RegExp(filter);
        if (! name.match(filterReg)) continue;
      }
      */
      filtered_repos.push(name);
      repositories[name] = {};
      repositories[name]['info'] = repos[i];
    }
  
    // Update total
    var total = document.getElementById('total');
    if (total) {
      total.innerHTML = repos.length+' modules';
    }

    for (var i=0; i<filtered_repos.length; i++) {
      var name = filtered_repos[i];
      var existing = document.getElementById(name);
      if (! existing) {
        var repoLine = document.createElement('tr');
        repoLine.setAttribute('id', name);
        reposTableBody.appendChild(repoLine);
  
        initRepo(name, repoHeads);
        updateRepo(name);
      } else if (refresh === name) {
        updateRepo(name);
      }
    }
    filtered_repos.sort();
  
    // Remove obsolete lines
    var listedRepos = reposTableBody.getElementsByTagName('tr');
    for (var i=0; i<listedRepos.length; i++) {
      var name = listedRepos[i].id;
      if (filtered_repos.indexOf(name) < 0) {
        listedRepos[i].style.display = 'none';
        refreshSort();
      }
    }
  
    // auto-refresh
    if (refresh > 0) {
      refresh_time = refresh + Math.random()*refresh*refresh_randomize;
      setTimeout(function() {updateModulesList(account, r10k_repo)}, refresh_time);
    }
  }

  function updateModuleList(account, r10k_repo, refresh) {
    octokit.rest.repos.getContent({
      owner: account,
      repo: r10k_repo,
      path: 'Puppetfile'
    }).then(({data}) => {
      console.log(data);
      var modules = parsePuppetfile(data);
      listRepos(modules, refresh);
  //  }).catch((error) => {
   //   dispError('Could not find Puppetfile: '+error);
    });
  }
 
  function initRepo(name, heads) {
    var info = repositories[name]['info'];
    var html = '<td><a href="#">'+name+'</a></td>';

    for (var i=0; i<heads.length; i++) {
      html += '<td class="'+heads[i]+'"><i class="fas fa-spinner fa-spin"></i></td>';
    }
  
    html += '<td><a href="javascript:refreshModule(\''+name+'\')"><i class="fas fa-sync-alt fa-1g"></i></a></td>';
    document.getElementById(name).innerHTML = html;
  }
  
  function refreshModule(name) {
    updateModuleList(account, r10k_repo, name);
  }

  function addCookie(name, value, expire) {
    createCookie(name, value, expire);
    cookies[name] = null;
  }

  export function PuppetDashboard(options) {
    var org = options.org;
    var user = options.user;
    r10k_repo = options.r10k_repo;
    refresh = options.refresh || 1800000; // 30 minutes
    refresh_randomize = options.refresh_randomize || 0.5; // up to 15 minutes
    var filter = options.filter;
    var autoload = options.autoload;
    var auth_link = options.auth_link || 'auth_link';
    var auth_link_priv = options.auth_link_priv || 'auth_link_priv';
    var auth_remove = options.auth_remove || 'auth_remove';
    plugin_options = options.plugin_options || {};

    account = org || user;

    this.sortByState = function() {
      var reposTable = document.getElementById('repositories');
      var heads = reposTable.getElementsByTagName('th');
      var refreshTH = heads[heads.length-1];
      sorttable.innerSortFunction.apply(refreshTH, []);
      // Twice, to sort by reverse order
      sorttable.innerSortFunction.apply(refreshTH, []);
    }
 
    this.refreshList = function() {
      updateModuleList(account, r10k_repo);
    }
  
    this.authRemove = function() {
      var cookie_names = Object.keys(cookies);
      for (var i=0; i<cookie_names.length; i++) {
        eraseCookie(cookie_names[i]);
      }
      window.location.reload();
    }
  
    // Plugins
    this.loadPlugin = function(plugin) {
      /*
      var script = document.createElement('script');
      script.type = 'module';
      script.src = 'plugins/'+plugin+'.js';
      document.body.appendChild(script);
      */
    }

    this.load = function(token, scope) {
      if (token) {
        var auth_link_e = document.getElementById(auth_link);
        var auth_link_priv_e = document.getElementById(auth_link_priv);
        var auth_remove_e = document.getElementById(auth_remove);
        if (auth_link_e) {
          auth_link_e.style.display = 'none';
        }
        if (scope == 'repo' && auth_link_priv_e) {
          auth_link_priv_e.style.display = 'none';
        } else {
          auth_link_priv_e.style.display = 'inline-block';
        }
        if (auth_remove_e) {
          auth_remove_e.style.display = 'inline-block';
        }
        octokit = new Octokit({
          auth: token
        });
      } else {
        // It's ok not to be authenticated
        octokit = new Octokit();
      }
    
      gh_user = octokit.rest.users.getAuthenticated();
    
      var reposTable = document.getElementById('repositories');
      var reposTableBody = document.getElementsByTagName('tbody')[0];
    
      // Remove all lines in body
      while (reposTableBody.hasChildNodes()) {
        reposTableBody.removeChild(reposTableBody.lastChild);
      }
    
      // Initialize
      repositories = {};
      repoHeads = [];
    
      // Get heads
      var headElems = reposTable.getElementsByTagName('th');
      for (var i=0; i<headElems.length; i++) {
        var classes = headElems[i].className.split(' ');
        for (var j=0; j<classes.length; j++) {
          if (classes[j].match(/^plugin:/)) {
            repoHeads.push(classes[j]);
          }
        }
      }
    
      // Load plugins
      for (var i=0; i<repoHeads.length; i++) {
        var plugin = repoHeads[i].replace('plugin:', '');
        this.loadPlugin(plugin);
      }
  
      var spinner = document.createElement('tr');
      spinner.setAttribute('id', 'spinner');
      spinner.innerHTML = '<td colspan="'+(repoHeads.length+2)+'"><img src="images/loading_bar.gif" /></td>';
    
      // TODO: get rid of user/org code
      reposTableBody.appendChild(spinner);
      updateModuleList(account, r10k_repo);
      sorttable.makeSortable(reposTable);
      this.sortByState();
    };

    // Main
    token = readCookie('access_token');
    if (token && autoload) {
      this.load(token);
    }
 
    /* Dashboard functions */
    
    // Called by authentication callback
    var self = this;
    window.authComplete = function(token, scope) {
      addCookie('access_token', token, 1);
      if (autoload) {
        self.load(token, scope);
      }
    }
  };

  if (typeof exports !== 'undefined') {
    // PuppetDashboard = exports;
    module.exports = PuppetDashboard;
    module.exports = updateRepo;
    module.exports = listRepos;
    module.exports = readCookie;
    module.exports = addCookie;
    module.exports = worstState;
  } else {
    window.PuppetDashboard = PuppetDashboard;
    window.updateRepo = updateRepo;
    window.refreshModule = refreshModule;
    window.listRepos = listRepos;
    window.readCookie = readCookie;
    window.addCookie = addCookie;
    window.worstState = worstState;
  }



//plugins


// endorsement
dashboard.endorsement = function(name, repo) {
  var html;
  if (repositories[name].forge) {
    html = repositories[name].forge.endorsement;
  } else {
    html = '';
  }
  updateCell(name, 'endorsement', html);
}

// issues
dashboard.issues = function(name) {
  listIssues(name, 'issues', false);
}

async function listIssues(name, plugin, incl_pulls) {
  var r = repositories[name];

  if (r.github.user !== account) {
    // Only relevant if it's our own module
    updateCell(name, plugin, 'N/A', 'ok', '-1');
    return;
  }

  console.log(plugin+": getting collabs");
  const collabsData = await octokit.rest.repos.listCollaborators({
    owner: r.github.user,
    repo: r.github.repo,
  });
  var collabs = collabsData.data;

  var issuesData;
  if (incl_pulls) {
    issuesData = await octokit.rest.pulls.list({
      owner: r.github.user,
      repo: r.github.repo
    });
  } else {
    issuesData = await octokit.rest.issues.listForRepo({
      owner: r.github.user,
      repo: r.github.repo
    });
  }

  var issues = issuesData.data;
  var status;
  var text;
  var customkey = 0;

  var t = 0;
  var l = 0;
  var title = '';
  for (var i=0; i < issues.length; i++) {
    var issue = issues[i];
    t++;
    // Check if issue was updated
    const issue_status = await issueStatus(r, issue, collabs);
    switch(issue_status.status) {
      case 'new_comments':
        l++;
        title += issue_status.message+"\n";
        break;
      case 'no_comments':
        l++;
        title += issue_status.message+"\n";
        break;
      case 'old_comment':
        l++;
        title += issue_status.message+"\n";
        break;
    }
  }
  var text = l+'/'+t;
  var customkey = 10*l+t;
  if (l > 0) {
    status = 'warn';
  } else {
    title = 'No actions needed';
    status = 'ok';
  }
  console.log(plugin+": updating cell");
  updateIssueCell(name, plugin, r, title, text, status, customkey);
}

function updateIssueCell(name, plugin, r, title, text, status, customkey) {
  var html = '<a href="'+r.github.repo_obj.info.html_url+'/'+plugin+'" title="'+title+'">'+text+'</a>';
  updateCell(name, plugin, html, status, customkey);
}



async function issueStatus(repo, issue, collabs) {
  console.log("Checking status for issue "+issue.number);

  // Get issues comments
  //console.log(plugin+": getting comments");
  const commentsData = await octokit.rest.issues.listComments({
    owner: repo.github.user,
    repo: repo.github.repo,
    issue_number: issue.number,
  });
  var comments = commentsData.data;

  // Newer comments are at the end of the list
  for (var i=comments.length-1; i >= 0; i--) {
    if (comments[i].issue_url === issue.url) {
      // Check that last comment was made less than 30 days ago
      var updated = new Date(comments[i].updated_at);
      var now = new Date();
      if ((now-updated)/(1000*3600*24*30) > 1) {
        return {
          'status': 'old_comment',
          'message': 'issue '+issue.number+' was last commented on '+updated.toDateString()
        };
      }

      // Check author of last comment
      for (var j=0; j < collabs.length; j++) {
        if (comments[i].user.login === collabs[j].login ) {
          return {
            'status': 'no_new_comments',
            'message': 'issue '+issue.number+' was last commented by '+comments[i].user.login
          };
        }
      }
      // Comment is not by a collaborator
      return {
        'status': 'new_comments',
        'message': 'New comment by '+comments[i].user.login+' on issue '+issue.number
      };
    }
  }
  // No comments found
  return {
    'status': 'no_comments',
    'message': 'No comments on issue '+issue.number
  };
}

dashboard.latest_version = function(name) {
  latestVersion(name);
}

async function latestVersion(name) {
  var r = repositories[name];
  var html;
  
  if (r.forge) {
    var version = r.forge.current_release.version;
    var version_url = 'https://forge.puppetlabs.com/'+r.forge.current_release.module.owner.username+'/'+r.forge.name+'/'+version;
    html = '<a href="'+version_url+'">'+version+'</a>';
    // compare with github/tags
    const tagsData = await octokit.rest.repos.listTags({
      owner: r.github.user,
      repo: r.github.repo,
    });
    const tags = tagsData.data;
    /*
      if (err) {
        html += ' <a href="'+r.github.repo_obj.info.tags_url+'" title="Failed to get tags"><i class="fa fa-warning"></i></a>';
        updateCell(name, 'latest_version', html, 'warn', '1');
        return;
      } else {
      */
    var new_ref;
    if (r.info.ref) {
      // Use ref as base
      new_ref = r.info.ref;
    } else {
      var new_ref_tag = versionTagURL(tags, r.info.version);
      if (new_ref_tag) {
        new_ref = new_ref_tag.tag;
      } else {
        // No tag found, it's a warning
        html += ' <a href="'+r.github.repo_obj.info.tags_url+'" title="No matching tag '+r.info.version+' found in repository"><i class="fa fa-warning"></i></a>';
        updateCell(name, 'latest_version', html, 'warn', '2');
        return;
      }
    }
    var version_tag = versionTagURL(tags, version);
    if (version_tag) {
      html += ' <a href="'+version_tag.url+'" title="Matching tag found in repository"><i class="fa fa-tag"></i></a>';
      checkForgeCommits(name, r, version, r.github.user, version_tag.tag, r.github.user, new_ref, html, true);
    } else {
      // No tag found, it's a warning
      html += ' <a href="'+r.info.tags_url+'" title="No matching tag '+version+' found in repository"><i class="fa fa-warning"></i></a>';
      updateCell(name, 'latest_version', html, 'warn', '3');
      return;
    }
  } else {
    // Nothing on forge, compare with account/master
    var version = 'master';
    var base_user;
    var version_url;
    if (r.github.repo_obj.info.fork) {
      base_user = r.github.repo_obj.info.parent.owner.login;
      version_url = r.github.repo_obj.info.parent.html_url;
    } else {
      base_user = r.github.user;
      version_url = r.github.uri;
    }
    html = '<a href="'+version_url+'">'+version+'</a>';
    checkForgeCommits(name, r, version, base_user, version, r.github.user, r.info.ref, html, false);
  }
}

async function checkForgeCommits(name, tags_r, version, base_user, base_ref, new_user, new_ref, html, check_release) {
  var state;
  var customkey;

  // get diff

  const diffData = await octokit.rest.repos.compareCommits({
    owner: tags_r.github.user,
    repo: tags_r.github.repo,
    base: base_user+':'+base_ref,
    head: new_user+':'+new_ref,
  });
  var diff = diffData.data;

  /*
    if (err) {
      html += ' <span title="Failed to get commits since tag"><i class="fa fa-warning"></i></span>';
      updateCell(name, 'latest_version', html, 'err', '15');
      return;
    } else {
    */
  var diff_url;
      if (diff.status == 'ahead') {
        diff_url = diff.html_url;
        html += ' <a href="'+diff_url+'" title="Branch '+new_ref+' is '+diff.ahead_by+' commits ahead of tag '+version+'"><i class="fa fa-angle-double-up"></i></a>';
        state = 'warn';
        customkey = '11';
      } else if (diff.status == 'behind') {
        diff_url = invertDiffURL(diff.html_url);
        html += ' <a href="'+diff_url+'" title="Branch '+new_ref+' is '+diff.behind_by+' commits behind of tag '+version+'"><i class="fa fa-angle-double-down"></i></a>';
        state = 'warn';
        customkey = '12';
      } else if (diff.status == 'diverged') {
        diff_url = diff.html_url;
        html += ' <a href="'+diff_url+'" title="Branch '+new_ref+' is '+diff.behind_by+' commits behind and '+diff.ahead_by+' commits ahead of tag '+version+'"><i class="fa fa-code-fork"></i></a>';
      } else if (diff.status == 'identical') {
        html += ' <span title="Branch '+new_ref+' is identical to tag '+version+'"><i class="fa fa-check"></i></span>';
        state = 'ok';
        customkey = '13';
        if (new_user === account && check_release) {
          // Check if a new release is due
          checkForgeCommits(name, tags_r, version, new_user, base_ref, new_user, 'master', html);
        }
      } else {
        html += ' <span title="Branch '+new_ref+' has comparison status with tag '+version+' set to '+diff.status+'"><i class="fa fa-warning"></i></span>';
        state = 'unknown';
        customkey = '14';
      }
    updateCell(name, 'latest_version', html, state, customkey);
    return;
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

dashboard.priv = function(name) {
  var repo = repositories[name].github.repo_obj.info;
  var html = repo.private ? '<i class="fa fa-lock"></i>' : '';
  var customkey = repo.private ? '1' : '0';
  updateCell(name, 'priv', html, null, customkey);
}

dashboard.pulls = function(name) {
  listIssues(name, 'pulls', true);
}

dashboard.status = function(name, repo) {
  if (repo.fork) {
    var p = repo.parent;
    var r = repositories[name]['repo'];
    var b = repo.default_branch;

    // get diff
    r.compare(p.owner.login+':'+b, account+':'+b, function(err, diff) {
      if (err) {
        updateCell(name, 'status', 'ERR', 'err');
      } else {
        var diff_msg;
        var state = 'ok';
        var customkey;
        var diff_url;
        if (diff.status == 'ahead') {
          diff_msg = '<span title="'+diff.ahead_by+' commits ahead"><i class="fa fa-angle-double-up"></i> ('+diff.ahead_by+')</span>';
          diff_url = diff.html_url;
          html = '<a href="'+diff_url+'">'+diff_msg+'</a>';
          state = 'warn';
          customkey = '3';
        } else if (diff.status == 'behind') {
          diff_msg = '<span title="'+diff.behind_by+' commits behind"><i class="fa fa-angle-double-down"></i> ('+diff.behind_by+')</span>';
          diff_url = invertDiffURL(diff.html_url);
          html = '<a href="'+diff_url+'">'+diff_msg+'</a>';
          state = 'ok';
          customkey = '2';
        } else if (diff.status == 'diverged') {
          ahead_url = diff.html_url;
          behind_url = invertDiffURL(diff.html_url);
          html = '<span title="'+diff.behind_by+' commits behind and '+diff.ahead_by+' commits ahead"><i class="fa fa-code-fork"></i></span> ';
          html += '<a href="'+behind_url+'" title="'+diff.behind_by+' commits behind">('+diff.behind_by+')</a> ';
          html += '<a href="'+ahead_url+'" title="'+diff.ahead_by+' commits ahead">('+diff.ahead_by+')</a>';
          state = 'err';
          customkey = '1';
        } else if (diff.status == 'identical') {
          diff_msg = '<i class="fa fa-check" title="identical"></i>';
          html = diff_msg;
          state = 'ok';
          customkey = '0';
        } else {
          diff_msg = diff.status;
          html = diff_msg;
          customkey = '4';
        }
        updateCell(name, 'status', html, state, customkey);
      }
    });
  } else {
    updateCell(name, 'status', '');
  }
}


dashboard.travis = function(name) {
  var r = repositories[name];

  if (r.github.user !== account) {
    // Only relevant if it's our own module
    updateCell(name, 'travis', 'N/A', 'unknown', '10');
    return;
  }

  var status = 'unknown';
  var repo = r.github.repo_obj.info;
  if (repo.private) {
    var access_token = readCookie('travis_access_token');
    if (access_token) {
      getTravisStatus(name, repo, true, access_token);
    } else {
      var gh_token = readCookie('access_token');
      travisAPICall('/auth/github', {"github_token": gh_token}, true, 'POST', null, false, function(err, res) {
        access_token = res.access_token;
        addCookie('travis_access_token', access_token, 1);
        getTravisStatus(name, repo, true, access_token);
      });
    }
  } else {
    getTravisStatus(name, repo, false, null);
  }
}

// Limit state to warning if repo is a fork
function travisMungeState(repo, state) {
  if ((repo.fork || repo.owner.login !== account) && state == 'err') {
    return 'warn';
  } else {
    return state;
  }
}

function getTravisStatus(name, repo, priv, travis_token) {
  var gh = repositories[name].github;
  travisAPICall('/repos/'+gh.user+'/'+gh.repo+'/branches/'+repo.default_branch, null, priv, 'GET', travis_token, false, function(err, res) {
    var msg;
    var customkey;
    var image;
    if (err) {
      msg = 'Error while getting Travis status';
      status = travisMungeState(repo, 'err');
      customkey = '9';
      image = null;
    } else {
      var date = new Date(res.branch.started_at);
      var date_str = ' on '+date.toLocaleDateString()+' at '+date.toLocaleTimeString();
      msg = 'Last build state: '+res.branch.state+' (build #'+res.branch.number+date_str+')';
      switch (res.branch.state) {
        case 'passed':
          status = 'ok';
          customkey = '0';
          image = 'passing';
          break;
        case 'failed':
          status = travisMungeState(repo, 'err');
          customkey = '1';
          image = 'failing';
          break;
        case 'errored':
          status = travisMungeState(repo, 'err');
          customkey = '2';
          image = 'error';
          break;
        case 'created':
          status = 'warn';
          customkey = '3';
          image = 'pending';
          break;
        case 'canceled':
          status = 'warn';
          customkey = '4';
          image = 'canceled';
          break;
        default:
          status = 'unknown';
          customkey = '5';
          image = 'unknown';
          break;
      }
    }
    var api = travisURL(priv);
    // TODO: pass name + repo.name
    updateTravisCell(name, 'https://'+api+'/', repo.default_branch, travis_token, msg, status, image, customkey);
  });
}

function travisAPICall(path, data, priv, verb, travis_token, use_corsproxy, cb) {
  var xhr = new XMLHttpRequest();
  var api = travisAPIURL(priv);
  var url;
  if (use_corsproxy) {
    url = 'http://www.corsproxy.com/'+api+path+'?'+ (new Date()).getTime(); 
  } else {
    url = 'https://'+api+path+'?'+ (new Date()).getTime(); 
  }
  xhr.dataType = "json";
  xhr.open(verb, url, true);
  xhr.onreadystatechange = function () {
    if (this.readyState == 4) {
      if (this.status >= 200 && this.status < 300 || this.status === 304) {
        cb(null, this.responseText ? JSON.parse(this.responseText) : true, this);
      } else {
        cb({path: path, request: this, error: this.status});
      }
    }
  }
  xhr.setRequestHeader('Accept','application/vnd.travis-ci.2+json');
  xhr.setRequestHeader('Content-Type','application/json;charset=UTF-8');
  if (travis_token) {
    xhr.setRequestHeader('Authorization','token "'+travis_token+'"');
  }
  data ? xhr.send(JSON.stringify(data)) : xhr.send();
}

function travisAPIURL(priv) {
  if (priv) {
    return 'api.travis-ci.com';
  } else {
    return 'api.travis-ci.org';
  }
}

function travisURL(priv) {
  if (priv) {
    return 'magnum.travis-ci.com';
  } else {
    return 'travis-ci.org';
  }
}

function updateTravisCell(name, travis_url, branch, travis_token, msg, status, image, customkey) {
  var gh = repositories[name].github;
  var html = '<a href="'+travis_url+gh.user+'/'+gh.repo+'">';
  if (image) {
    var image_src = 'images/travis/'+image+'.svg';
    html += '<img src="'+image_src+'" title="'+msg+' (state='+status+')" />';
  } else {
    html += '<span title="'+msg+'">'+status+'</span>';
  }
  html += '</a>';
  updateCell(name, 'travis', html, status, customkey);
}

