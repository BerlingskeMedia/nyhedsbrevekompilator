app.controller('NewsletterEditorController', ['$scope', '$routeParams', '$location', '$resource', '$sce', '$http', '$q', 'notifications', 'loadingSwitch',
  function ($scope, $routeParams, $location, $resource, $sce, $http, $q, notifications, loadingSwitch) {

    // Defaulting the schedule with an added 15 minuttes
    $scope.at = new Date(new Date().getTime() + 15*60000);

    var Newsletters = $resource('/newsletters/:name', { name: '@name' });
    var Identities = $resource('/newsletters/identities');
    var Lists = $resource('/newsletters/lists/:list', { list: '@list' });
    var Templates = $resource('/templates/:name', { name: '@name' });

    var abe = loadingSwitch.turnOn();

    $scope.edit = $routeParams.operator === 'edit';

    if ($scope.edit) {

      $scope.identities = Identities.query();
      $scope.lists = Lists.query();
      $scope.html_templates = Templates.query({filter:'.html'});
      $scope.plain_templates = Templates.query({filter:'.plain'});

      // Waiting for the drop-down data to be fetched before we query the newsletter.
      // This is done so that drop-downs are populated and the equivalent newsletter value is selected in the drop-down.
      $q.all([$scope.identities.$promise, $scope.lists.$promise, $scope.html_templates.$promise, $scope.plain_templates.$promise]).then(function () {
        $scope.newsletter = Newsletters.get({ name: $routeParams.name }, function () { /* All OK. */ }, resourceErrorHandler);

        abe.turnOff();
        console.log('abe turnOff edit');
      });

    } else {

      // If we're not editing the newsletter, we don't need to fetch the dop-down data from e.g. SendGrid
      $scope.newsletter = Newsletters.get({name: $routeParams.name}, function () {
        // Populating the drop downs so newsletter values are visible
        $scope.html_templates = [$scope.newsletter.template_html];
        $scope.plain_templates = [$scope.newsletter.template_plain];
        $scope.identities = [$scope.newsletter.identity];
        $scope.lists = [$scope.newsletter.list];

        // Validating the list still exists in SendGrid
        Lists.query({ list: $scope.newsletter.list}, function (response) {
          if (response[0] === undefined || response[0].list !== $scope.newsletter.list) {
            console.log('Couldn\'t find list ' + $scope.newsletter.list + ' in SendGrid.')
            $scope.lists = ['ERROR'];
          }
        }, resourceErrorHandler);

        updatePreview();
        //updateControlroomIframe();

        //loadingSwitch.turnOff();
        
        abe.turnOff();
        console.log('abe turnOff none-edit');
      }, resourceErrorHandler);
    }


    function resourceErrorHandler (response) {
      console.log('Error fetching ' + $routeParams.name, response);
      if (response.status === 404) {
        $location.url('/');
      }
    }


    $scope.addCategory = function (clickEvent) {
      if ($scope.newsletter.categories == undefined) {
        $scope.newsletter.categories = [];
      }

      if (clickEvent.keyCode === 13) {
        if ($scope.newCategory !== '') {
          $scope.newCategory.split(',').forEach( function (category) {
            category = category.trim();
            if ($scope.newsletter.categories.indexOf(category) === -1 && category !== $scope.newsletter.name) {
              $scope.newsletter.categories.push(category);
            }
          });
          $scope.newCategory = '';
        }
      }
    };


    $scope.removeCategory = function (categoryIndex) {
      $scope.newsletter.categories.splice(categoryIndex, 1);
    };


    $scope.saveNewsletter = function (close) {
      
      //var abe2 = loadingSwitch.turnOn('Saving');

      Newsletters.save($scope.newsletter, function (success) {
        console.log('Success saving template.');
        if (close === true) {
          $location.url('/' + $scope.newsletter.name );        
        } else {
          notifications.showSuccess('Saved');
        }

        abe2.turnOff();

      });
    };

    $scope.deleteNewsletter = function () {

      var abe3 = loadingSwitch.turnOn('Deleting');

      Newsletters.delete({ name: $scope.newsletter.name }, function () {
        abe3.turnOff();
        $location.url('/');
      });
    };

    $scope.updatePreviewClickEvent = function () {
      updatePreview();
    };


    function updatePreview () {
      if ($scope.newsletter.bond_url === undefined) {
        notifications.showWarning('Missing BOND Url');
        return;
      }

      //var abe4 = loadingSwitch.turnOn();

      $scope.loading_previews = true;

      var a = updateHtmlPreview();
      var b = updatePlainPreview();

      $q.all([a,b]).then(function (result) {
        $scope.loading_previews = false;
        abe4.turnOff();
        console.log('abe4 turnOff');
      },function (reason) {
        $scope.loading_previews = false;
        abe4.turnOff();
        console.log('abe4 turnOff error');
      });
    }


    function updateHtmlPreview () {
      if ($scope.newsletter.template_html === undefined) {
        notifications.showWarning('Missing HTML template');
        return;
      }

      var abe_1 = loadingSwitch.turnOn();

      $scope.loading_html_preview = true;

      return $http.get('/templates/' + $scope.newsletter.template_html + '?u=' + encodeURIComponent($scope.newsletter.bond_url))
      .success(function (data, status, getHeaders) {
        var headers = getHeaders();
        $scope.newsletter.subject = decodeURIComponent(headers['x-subject-suggestion']);
        $scope.newsletter.checksum = headers['x-content-checksum'];
        $scope.controlroom_url = $sce.trustAsUrl(decodeURIComponent(headers['x-controlroom-url']));
        $scope.newsletter.email_html = data;
        $scope.trusted_html_email_preview = $sce.trustAsHtml(data);
        $scope.loading_html_preview = false;
        abe_1.turnOff();
        console.log('abe_1 turnOff');
      })
      .error(function (data, status, headers, config) {
        console.log('updateHtmlPreview error', data);
        if (data.message) {
          notifications.showError(data.message);
        } else {
          notifications.showError('Error');
        }
        $scope.loading_html_preview = false;
        $scope.newsletter.email_html = '';
        $scope.trusted_html_email_preview = '<p>Error</p>';
        abe_1.turnOff();
        console.log('abe_1 turnOff error');
      });
    };


    function updatePlainPreview () {
      if ($scope.newsletter.template_plain === undefined) {
        notifications.showWarning('Missing Text template');
        return;
      }

      //var abe_2 = loadingSwitch.turnOn();

      $scope.loading_plain_preview = true;

      return $http.get('/templates/' + $scope.newsletter.template_plain + '?u=' + encodeURIComponent($scope.newsletter.bond_url))
      .success(function (data) {
        $scope.newsletter.email_plain = data;
        $scope.loading_plain_preview = false;
        abe_2.turnOff();
        console.log('abe_2 turnOff');
      })
      .error(function (data, status, headers, config) {
        $scope.loading_plain_preview = false;
        abe_2.turnOff();
        console.log('abe_2 turnOff error');
      });
    };


    $scope.sendNewsletter = function () {

      var abe5 = loadingSwitch.turnOn('Sending');

      if($scope.at > Date.now()) {
        $scope.newsletter.at = $scope.at.toISOString();
        console.log('Scheduled to', $scope.newsletter.at);
      } else {
        console.log('Sending straight away');
      }

      $http.post('/newsletters/send', $scope.newsletter)
      .success(function (data) {
        abe5.turnOff();
        notifications.showSuccess('Sendt ' + data.name);
      })
      .error(function (data, status) {
        abe5.turnOff();
        console.log('Error', status, data);
        notifications.showError('Error: ' + data.message);
      });
    };


    $scope.draftNewsletter = function () {
      
      var abe6 = loadingSwitch.turnOn('Creating');

      $http.post('/newsletters/draft', $scope.newsletter)
      .success(function (data) {
        abe6.turnOff();
        notifications.showSuccess('Kladde oprettet ' + data.name);
      })
      .error(function (data, status) {
        abe6.turnOff();
        console.log('Error', status, data);
      });
    };


    function updateControlroomIframe () {
      if ($scope.newsletter.bond_url === undefined) {
        return;
      }

      $http.get('/templates/controlroom?u=' + encodeURIComponent($scope.newsletter.bond_url))
      .success(function (data) {
        $scope.controlroom_url = $sce.trustAsResourceUrl(data.url);
      });
    }
  }]);
