/*!
 * bfarm renderfarm 0.1pre web interface
 *
 * Copyright 2010, Sergey Sharybin
 * Licensed under the GPL Version 2 license.
 *
 */

var jobs = new function () {
  var attrs = [{'title': 'Identifier', 'field': 'uuid'},
               {'title': 'Registration time', 'field': 'time', 'filter': function (unixtime) { return new Date(parseInt(unixtime)*1000);}},
               {'title': 'File', 'field': 'fname'},
               {'title': 'Type', 'field': 'type'},
               {'title': 'Start frame', 'field': 'start_frame'},
               {'title': 'End frame', 'field': 'end_frame'},
               {'title': 'Fie format', 'field': 'file_format'},
               {'title': 'X-resolution', 'field': 'resol_x'},
               {'title': 'Y-resolution', 'field': 'resol_y'},
               {'title': 'Total tasks', 'field': 'ntasks'},
               {'title': 'Completed tasks', 'field': 'progress'}];

  var TYPE_ANIM = 0;
  var TYPE_STILL = 1;

  function browseRenders(job) {
    window.open('/renders/job-' + job['uuid']);
  };

  function createJobBox(job, collapsed) {
    /* XXX: replace with form template */
    var box = new UICollapseBox({'title': job.title,
                                 'collapsed': collapsed,
                                 'animated': true,
                                 'name': 'jobBox_' + job.uuid});

    var grid = new UIGrid({'cols': 2,
                           'rows': 2,
                           'padding': 2});

    grid.setCellStyle(0, 0, {'valign': 'top'});
    grid.setCellStyle(0, 1, {'valign': 'top'});
    grid.setCellStyle(1, 0, {'colspan': 2});

    var attrGrid = new UIGrid({'cols': 2,
                               'rows': attrs.length + 1,
                               'padding': 2});
    attrGrid.setCellStyle(0, 0, {'width': 120});
    attrGrid.setCellStyle(attrs.length, 0, {'colspan': 2});

    for(var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
      var text = job[attr['field']];

      if (attr['filter'])
        text = attr['filter'] (text);

      attrGrid.add (new UILabel({'text': attr['title']}));
      attrGrid.add (new UILabel({'text': text}));
    }

    attrGrid.add (new UIProgress({'position': job.progress / job.ntasks,
                                  'title': 'Progress'}));

    grid.add (attrGrid);

    var frameGrid = new UIGrid({'cells': 1, 'rows': 2, 'padding': [0, 0, 2, 18]});
    var lastFrame = '/pics/not_avaliable.png';
    if(job['last_frame'])
      lastFrame = '/renders/job-' + job['uuid'] + '/' + job['last_frame'] + '?thumbnail=1';

    frameGrid.add (new UILabel({'text': 'Last rendered frame:'}));
    frameGrid.add (new UIImage({'image': lastFrame}));
    grid.add (frameGrid);

    grid.add (new UIButton({'title': 'Browse render files',
                            'image': '/pics/buttons/browse.gif',
                            'click': function (job) { return function () {
                                           browseRenders (job);
                                         };
                                       } (job)}));

    box.add(grid);

    return box;
  };

  function isJobBoxCollapsed(job) {
    var collapsed = true;
    $(['#jobsList', '#completedJobsList']).each(function() {
      var boxHolder = $('' + this)[0].childNodes[0];

      if (boxHolder) {
        var p = boxHolder.uiWidget;
        var box = p.lookupWidget ('jobBox_' + job.uuid);
        if (!box || !box.getCollapsed ()) collapsed = false;
        else collapsed = true;
      }
    });

    return collapsed;
  };

  function createJobsDom(where, title, data, collapsed) {
    if (!data.length) {
      where.parent().css('padding', '0');
      where.empty();
      return;
    } else {
      where.parent().css('padding', '');
    }

    var jobsGroup = new UIGroupBox({'title': title});
    var grid = new UIGrid({'padding': 2,
                           'rows': data.length})

    for(var i = 0; i < data.length; i++) {
      var box = createJobBox(data[i], isJobBoxCollapsed(data[i]));
      grid.add(box);
    }

    jobsGroup.add(grid);

    where.empty();
    where.append(jobsGroup.build());
  };

  function reloadJobs() {
    var jobsList = $('#jobsList');

    if (jobsList.length) {
      $.getJSON('/ajax/get/jobs',
                function (data) {
                    createJobsDom($('#jobsList'), 'Running jobs', data);
                });
    }
  };

  function reloadCompletedJobs(collapsed) {
    var completedJobsList = $('#completedJobsList');

    if (completedJobsList.length) {
      $.getJSON('/ajax/get/completedJobs',
                function (data) {
                    createJobsDom($('#completedJobsList'), 'Completed jobs', data);
                });
    }
  };

  function reloadAllJobs() {
    reloadCompletedJobs ();
    reloadJobs ();
  };

  function createJobs() {
    reloadAllJobs();
  };

  function createJobButtons() {
    var jobsReload = $('#jobsButtons');
    if (jobsReload.length) {
      var grid = new UIGrid({"rows": 1,
                             "cols": 2,
                             "cellStyles": [[{"padding": [0, 2, 0, 0]}, {"padding": [0, 0, 0, 2]}]]});

      var reloadBtn = new UIButton({"title": "Reload jobs",
                                    'image': '/pics/buttons/refresh.gif',
                                    "click": reloadAllJobs});
      grid.add(reloadBtn);

      var registerBtn = new UIButton({"title": "Register job",
                                      'image': '/pics/buttons/add.gif',
                                      "click": jobs.register.show});
      grid.add(registerBtn);

      jobsReload.append(grid.build());
    }
  };

  /* fill page with jobs information blocks */
  this.fillPage = function() {
    createJobs();
    createJobButtons();
  };

  this.register = new function() {
    this.show = function () {
      if (jobs.registerWnd)
        return;

      var wnd = new UIWindow({'title': 'Register job',
                              'name': 'registerJobWnd',
                              'width': 550,
                              'height': 280,
                              'modal': true,
                              'position': 'center',
                              'resizable': false,
                              'buttons': ['CLOSE']});
      wnd.onClose = function() { jobs.registerWnd = null; };

      var form = uiCreator.create('url://src/forms/jobsRegisterForm.js');
      wnd.add(form);
      wnd.show();

      jobs.registerWnd = wnd;
    };

    this.hide = function () {
      if (jobs.registerWnd) {
        jobs.registerWnd.close ();
        jobs.registerWnd = null;
      }
    };

    this.onTypeChanged = function (widget, userData, attrs) {
      var p = widget;

      while (p && p.getName() != 'registerJobWnd') {
        p = p.parent;
      }

      if(p) {
        var animSettingsPanel = p.lookupWidget ('animSettingsPanel');
        var stillSettingsPanel = p.lookupWidget ('stillSettingsPanel');
        var index = widget.getActiveIndex();

        switch(index) {
          case TYPE_ANIM:
            animSettingsPanel.setVisible(true);
            stillSettingsPanel.setVisible(false);
            break;
          case TYPE_STILL:
            animSettingsPanel.setVisible(false);
            stillSettingsPanel.setVisible(true);
            break;
        }
      }
    };

    this.submit = function(widget) {
      var cur = widget.dom;
      var form = $('#jobRegister')[0];

      if (form) {
        form.submit();
      }
    };
  };
};
