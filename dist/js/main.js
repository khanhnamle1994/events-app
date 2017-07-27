(function () {
    'use strict';

    angular
        .module('main', [
            'ui.router',
            'ui.bootstrap',
            'ngMask',
            'ngCookies',
            'ngRoute',
            'ngDialog',
            'cr.acl',
            'ui-notification',
            'ngFlash',
            'textAngular',
            'flow',
            'angular-loading-bar',

            'event',
            'user',

            'config'
        ])
        .config(config)
        .run(run);

    var app = angular
        .module('main');

    config.$inject = ['$stateProvider', '$urlRouterProvider', 'cfpLoadingBarProvider', 'BUCKET_SLUG'];
    function config($stateProvider, $urlRouterProvider, cfpLoadingBarProvider, BUCKET_SLUG) {
        cfpLoadingBarProvider.includeSpinner = false;


        $urlRouterProvider.otherwise(function ($injector) {
            var $state = $injector.get("$state");
            var $location = $injector.get("$location");
            var crAcl = $injector.get("crAcl");

            var state = "";

            switch (crAcl.getRole()) {
                case 'ROLE_USER':
                    state = 'main.event.feed';
                    break;
            }

            if (state) $state.go(state);
            else $location.path('/login');
        });

        $stateProvider
            .state('main', {
                url: '/',
                abstract: true,
                templateUrl: '../views/main.html',
                controller: 'UserCtrl as global',
                data: {
                    is_granted: ['ROLE_USER']
                }
            })
            .state('blog', {
                url: '/blog',
                templateUrl: '../blog.html',
                data: {
                    is_granted: ['ROLE_USER']
                }
            })
            .state('auth', {
                url: '/login',
                templateUrl: '../views/auth/login.html',
                controller: 'AuthCtrl as auth',
                onEnter: ['AuthService', function(AuthService) {
                    AuthService.clearCredentials();
                }],
                data: {
                    is_granted: ['ROLE_GUEST']
                }
            });
    }

    run.$inject = ['$rootScope', '$cookieStore', '$http', 'crAcl'];

    function run($rootScope, $cookieStore, $http, crAcl) {
        // function saveConfig(response) {
        //     app.constant('BUCKET_SLUG', response.data.BUCKET_SLUG || 'events');
        //     app.constant('URL', 'https://api.cosmicjs.com/v1/');
        //     app.constant('MEDIA_URL', 'https://api.cosmicjs.com/v1/events/media');
        //     app.constant('READ_KEY', 'NSAzCEjy62aPHj4tpUNrzeBY3IBfFDHPK67A9eqIOGsZqgztnf');
        //     app.constant('WRITE_KEY', 'GXQFFuUibgOtKB29ywtKwwXdpFK29fBZrBnO3YjtfTcV6qkpld');
        //     app.constant('DEFAULT_EVENT_IMAGE', 'https://cosmicjs.com/uploads/ce6ed110-31da-11e7-aef2-87741016d54e-no_image.png');
        // }
        //
        // function error() {
        //     Notification.error('Config variables not found!');
        // }
        //
        // $http.get('/config').then(saveConfig, error);

        $rootScope.globals = $cookieStore.get('globals') || {};
        $http.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

        crAcl
            .setInheritanceRoles({
                'ROLE_SUPER_ADMIN': ['ROLE_SUPER_ADMIN', 'ROLE_GUEST'],
                'ROLE_USER': ['ROLE_USER', 'ROLE_GUEST'],
                'ROLE_GUEST': ['ROLE_GUEST']
            });

        crAcl
            .setRedirect('auth');

        if ($rootScope.globals.currentUser) {

            crAcl.setRole($rootScope.globals.currentUser.metadata.role);
        }
        else {
            crAcl.setRole();
        }

    }

})();

(function () {
    'use strict';

    angular
        .module('main')
        .controller('AuthCtrl', AuthCtrl);

    function AuthCtrl(crAcl, $state, AuthService, Flash, $log) {
        var vm = this;

        vm.login = login;
        vm.register = register;

        vm.showRegisterForm = false;

        vm.loginForm = null;
        vm.registerForm = null;

        vm.credentials = {};
        vm.user = {};

        function login(credentials) {
            function success(response) {
                function success(response) {
                    if (response.data.status !== 'empty') {
                        var currentUser = response.data.objects[0];

                        crAcl.setRole(currentUser.metadata.role);
                        AuthService.setCredentials(currentUser);
                        $state.go('main.event.feed');
                    }
                    else
                        Flash.create('danger', 'Incorrect username or password');
                }

                function failed(response) {
                    $log.error(response);
                }

                if (response.data.status !== 'empty')
                    AuthService
                        .checkPassword(credentials)
                        .then(success, failed);
                else
                    Flash.create('danger', 'Incorrect username or password');

                $log.info(response);
            }

            function failed(response) {
                $log.error(response);
            }

            if (vm.loginForm.$valid)
                AuthService
                    .checkUsername(credentials)
                    .then(success, failed);
        }

        function register(credentials) {
            function success(response) {
                $log.info(response);

                var currentUser = response.data.object.metafields;

                Flash.create('success', 'You have successfully signed up!');
                vm.credentials = {
                    username: currentUser[0].value,
                    password: currentUser[3].value
                };
                vm.showRegisterForm = false;
            }

            function failed(response) {
                $log.error(response);
            }

            if (vm.registerForm.$valid)
                AuthService
                    .register(credentials)
                    .then(success, failed);
        }

    }
})();

(function () {
    'use strict';

    angular
        .module('main')
        .service('AuthService', function ($http,
                                          $cookieStore,
                                          $q,
                                          $rootScope,
                                          URL, BUCKET_SLUG, READ_KEY, WRITE_KEY) {
            var authService = this;
            $http.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

            authService.checkUsername = function (credentials) {
                return $http.get(URL + BUCKET_SLUG + '/object-type/users/search', {
                    params: {
                        metafield_key: 'username',
                        metafield_value_has: credentials.username,
                        limit: 1,
                        read_key: READ_KEY
                    }
                });
            };
            authService.checkPassword = function (credentials) {
                return $http.get(URL + BUCKET_SLUG + '/object-type/users/search', {
                    ignoreLoadingBar: true,
                    params: {
                        metafield_key: 'password',
                        metafield_value: credentials.password,
                        limit: 1,
                        read_key: READ_KEY
                    }
                });
            };
            authService.register = function (user) {

                return $http.post(URL + BUCKET_SLUG + '/add-object', {
                    title: user.full_name,
                    type_slug: 'users',
                    slug: user.username,
                    metafields: [
                        {
                            key: "username",
                            type: "text",
                            value: user.username
                        },
                        {
                            key: "email",
                            type: "text",
                            value: user.email
                        },
                        {
                            key: "full_name",
                            type: "text",
                            value: user.full_name
                        },
                        {
                            key: "password",
                            type: "text",
                            value: user.password
                        },
                        {
                            key: "image",
                            type: "file",
                            value: "89295c10-3667-11e7-9161-61cd2f0acd2a-nopic_192.gif"
                        },
                        {
                            key: "role",
                            type: "radio-buttons",
                            options: [
                                {
                                    value: "ROLE_USER"
                                },
                                {
                                    value: "ROLE_SUPER_ADMIN"
                                }
                            ],
                            value: "ROLE_USER"
                        }
                    ],

                    write_key: WRITE_KEY
                });
            };
            authService.setCredentials = function (user) {
                $rootScope.globals = {
                    currentUser: user
                };

                $cookieStore.put('globals', $rootScope.globals);
            };
            authService.clearCredentials = function () {
                var deferred = $q.defer();
                $cookieStore.remove('globals');

                if (!$cookieStore.get('globals')) {
                    $rootScope.globals = {};
                    deferred.resolve('Credentials clear success');
                } else {
                    deferred.reject('Can\'t clear credentials');
                }

                return deferred.promise;
            };
        });
})();
angular.module("config", [])
.constant("BUCKET_SLUG", "events-app")
.constant("MEDIA_URL", "https://api.cosmicjs.com/v1/events-app/media")
.constant("READ_KEY", "")
.constant("WRITE_KEY", "");

(function () {
    'use strict';

    var app = angular
                .module('main');

    // app.constant('BUCKET_SLUG', 'events');
    app.constant('URL', 'https://api.cosmicjs.com/v1/');
    // app.constant('MEDIA_URL', 'https://api.cosmicjs.com/v1/events/media');
    // app.constant('READ_KEY', 'NSAzCEjy62aPHj4tpUNrzeBY3IBfFDHPK67A9eqIOGsZqgztnf');
    // app.constant('WRITE_KEY', 'GXQFFuUibgOtKB29ywtKwwXdpFK29fBZrBnO3YjtfTcV6qkpld');
    app.constant('DEFAULT_EVENT_IMAGE', 'https://cosmicjs.com/uploads/ce6ed110-31da-11e7-aef2-87741016d54e-no_image.png');

})();


(function () {
    'use strict';

    angular
        .module('main')
        .controller('EventCtrl', EventCtrl);

    function EventCtrl(EventService, Notification, $log, $rootScope, DEFAULT_EVENT_IMAGE) {
        var vm = this;

        vm.getEvents = getEvents;
        vm.removeEvent = removeEvent;
        vm.DEFAULT_EVENT_IMAGE = DEFAULT_EVENT_IMAGE;

        function getEvents(username) {
            function success(response) {
                $log.info(response);

                vm.events = response.data.objects;
            }

            function failed(response) {
                $log.error(response);
            }
            console.log(username);

            EventService
                .getEventsByUsername(username)
                .then(success, failed);
        }

        function removeEvent(slug) {
            function success(response) {
                $log.info(response);

                getEvents($rootScope.globals.currentUser.metadata.username);

                Notification.success('Deleted');
            }

            function failed(response) {
                Notification.error(response.data.message);

                $log.error(response);
            }

            EventService
                .removeEvent(slug)
                .then(success, failed);
        }
    }
})();

(function () {
    'use strict';

    angular
        .module('event', [
            'event.profile',
            'event.feed',
            'event.add'
        ])
        .config(config);

    config.$inject = ['$stateProvider', '$urlRouterProvider'];
    function config($stateProvider, $urlRouterProvider) {

        $stateProvider
            .state('main.event', {
                url: 'events',
                views: {
                    '': {
                        templateUrl: '../views/event/events.html',
                        controller: 'EventCtrl as vm'
                    }
                },
                data: {
                    is_granted: ['ROLE_USER']
                }
            });
    }

})();

(function () {
    'use strict';

    angular
        .module('main')
        .service('EventService', function ($http,
                                          $cookieStore,
                                          $q,
                                          $rootScope,
                                          URL, BUCKET_SLUG, READ_KEY, WRITE_KEY, MEDIA_URL) {

            $http.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

            this.getEvents = function () {
                return $http.get(URL + BUCKET_SLUG + '/object-type/events', {
                    params: {
                        limit: 100,
                        read_key: READ_KEY
                    }
                });
            };
            this.getEventsByUsername = function (username, ignoreLoadingBar) {
                return $http.get(URL + BUCKET_SLUG + '/object-type/events/search',
                    {
                        ignoreLoadingBar: ignoreLoadingBar,
                        params: {
                            metafield_key: 'user',
                            metafield_object_slug: username,
                            limit: 10,
                            read_key: READ_KEY
                        }
                    }
                );
            };
            this.getEventById = function (slug) {
                return $http.get(URL + BUCKET_SLUG + '/object/' + slug, {
                    params: {
                        read_key: READ_KEY
                    }
                });
            };
            this.updateEvent = function (event) {
                event.write_key = WRITE_KEY;

                return $http.put(URL + BUCKET_SLUG + '/edit-object', event);
            };
            this.removeEvent = function (slug) {
                return $http.delete(URL + BUCKET_SLUG + '/' + slug, {
                    ignoreLoadingBar: true,
                    headers:{
                        'Content-Type': 'application/json'
                    },
                    data: {
                        write_key: WRITE_KEY
                    }
                });
            };
            this.slugify = function (text) {
              return text.toString().toLowerCase()
                .replace(/\s+/g, '-')           // Replace spaces with -
                .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
                .replace(/\-\-+/g, '-')         // Replace multiple - with single -
                .replace(/^-+/, '')             // Trim - from start of text
                .replace(/-+$/, '');            // Trim - from end of text
            };
            this.createEvent = function (event) {
                event.write_key = WRITE_KEY;

                var beginDate = new Date(event.metafields[1].value);
                var endDate = new Date(event.metafields[2].value);

                event.metafields[1].value = beginDate.getFullYear() + '-' + (beginDate.getMonth() + 1) + '-' + beginDate.getDate();
                event.metafields[2].value = endDate.getFullYear() + '-' + (beginDate.getMonth() + 1) + '-' + endDate.getDate();

                event.slug = this.slugify(event.title);
                event.type_slug = 'events';

                event.metafields[4] = {
                    key: "user",
                    type: "object",
                    object_type: "users",
                    value: $rootScope.globals.currentUser._id
                };
                console.log(event);
                return $http.post(URL + BUCKET_SLUG + '/add-object', event);
            };
            this.upload = function (file) {
                var fd = new FormData();
                fd.append('media', file);
                fd.append('write_key', WRITE_KEY);

                var defer = $q.defer();

                var xhttp = new XMLHttpRequest();

                xhttp.upload.addEventListener("progress",function (e) {
                    defer.notify(parseInt(e.loaded * 100 / e.total));
                });
                xhttp.upload.addEventListener("error",function (e) {
                    defer.reject(e);
                });

                xhttp.onreadystatechange = function() {
                    if (xhttp.readyState === 4) {
                        defer.resolve(JSON.parse(xhttp.response)); //Outputs a DOMString by default
                    }
                };

                xhttp.open("post", MEDIA_URL, true);

                xhttp.send(fd);

                return defer.promise;
            }
        });
})();
(function () {
    'use strict';

    angular
        .module('main')
        .controller('UserCtrl', UserCtrl);

    function UserCtrl($rootScope, $scope, $state, AuthService, Flash, $log) {
        var vm = this;

        vm.currentUser = $rootScope.globals.currentUser.metadata;

        vm.logout = logout;

        function logout() {
            function success(response) {
                $state.go('auth');

                $log.info(response);
            }

            function failed(response) {
                $log.error(response);
            }

            AuthService
                .clearCredentials()
                .then(success, failed);
        }

        $scope.state = $state;

    }
})();

(function () {
    'use strict';

    angular
        .module('user', [
            'user.profile',
            'user.settings'
        ])
        .config(config);

    config.$inject = ['$stateProvider', '$urlRouterProvider'];
    function config($stateProvider, $urlRouterProvider) {

        $stateProvider
            .state('main.user', {
                url: 'user',
                abstract: true,
                data: {
                    is_granted: ['ROLE_USER']
                }
            });
    }
})();

(function () {
    'use strict';

    angular
        .module('main')
        .service('UserService', function ($http,
                                          $cookieStore,
                                          $q,
                                          $rootScope,
                                          URL, BUCKET_SLUG, READ_KEY, WRITE_KEY) {
            $http.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

            this.getCurrentUser = function (ignoreLoadingBar) {
                return $http.get(URL + BUCKET_SLUG + '/object/' + $rootScope.globals.currentUser.slug, {
                    ignoreLoadingBar: ignoreLoadingBar,
                    params: {
                        read_key: READ_KEY
                    }
                });
            };
            this.getUser = function (slug, ignoreLoadingBar) {
                return $http.get(URL + BUCKET_SLUG + '/object/' + slug, {
                    ignoreLoadingBar: ignoreLoadingBar,
                    params: {
                        read_key: READ_KEY
                    }
                });
            };
            this.updateUser = function (user) {
                user.write_key = WRITE_KEY;

                return $http.put(URL + BUCKET_SLUG + '/edit-object', user, {
                    ignoreLoadingBar: false
                });
            };

        });
})();
(function () {
    'use strict';

    angular
        .module('main')
        .controller('EventAddCtrl', EventAddCtrl);

    function EventAddCtrl(EventService, Notification, $state, $log, $scope, MEDIA_URL, DEFAULT_EVENT_IMAGE, $timeout) {
        var vm = this;

        vm.createEvent = createEvent;
        vm.cancelUpload = cancelUpload;
        vm.upload = upload;

        vm.dateBeginPicker = false;
        vm.dateEndPicker = false;
        vm.contentEditor = true;
        vm.uploadProgress = 0;

        vm.event = {
            title: null,
            slug: null,
            content: null,
            metafields: [
                {
                    key: "image",
                    type: "file",
                    value: null
                },
                {
                    key: "date_begin",
                    type: "date",
                    value: null
                },
                {
                    key: "date_end",
                    type: "date",
                    value: null
                },
                {
                    key: "type",
                    type: "select-dropdown",
                    options: [
                        {
                            key: "social",
                            value: "Social"
                        },
                        {
                            key: "fun",
                            value: "Fun"
                        }
                    ],
                    value: "Social"
                }
            ]
        };

        $timeout(function() {
            vm.event.metafields[1].value = new Date();
            vm.event.metafields[2].value = new Date();
        }, 100);

        vm.flow = {};
        vm.background = {
            'background-image': 'url(' + DEFAULT_EVENT_IMAGE + ')'
        };

        vm.flowConfig = {
            target: MEDIA_URL,
            singleFile: true
        };

        function createEvent() {
            if (vm.flow.files[0])
                upload();
            else
                _createEvent(vm.event);
        }

        function _createEvent(event) {
            function success(response) {
                $log.info(response);

                Notification.success(
                    {
                        message: 'Created',
                        delay: 800,
                        replaceMessage: true
                    }
                );

                $state.go('main.event');
            }

            function failed(response) {
                Notification.error(
                    {
                        message: response.data.error,
                        delay: 4000,
                        replaceMessage: true
                    }
                );

                $log.error(response);
            }

            EventService
                .createEvent(event)
                .then(success, failed);
        }

        function cancelUpload() {
            vm.flow.cancel();
            vm.background = {
                'background-image': 'url(' + DEFAULT_EVENT_IMAGE.url + ')'
            };
        }

        $scope.$watch('vm.flow.files[0].file.name', function () {
            if (!vm.flow.files[0]) {
                return ;
            }
            var fileReader = new FileReader();
            fileReader.readAsDataURL(vm.flow.files[0].file);
            fileReader.onload = function (event) {
                $scope.$apply(function () {
                    vm.background = {
                        'background-image': 'url(' + event.target.result + ')'
                    };
                });
            };
        });

        function upload() {
            EventService
                .upload(vm.flow.files[0].file)
                .then(function(response){

                    vm.event.metafields[0].value = response.media.name;

                    createEvent(vm.event);

                    vm.flow.cancel();
                    vm.uploadProgress = 0;

                }, function(){
                    console.log('failed :(');
                }, function(progress){
                    vm.uploadProgress = progress;
                });

        }

    }
})();

(function () {
    'use strict';

    angular
        .module('event.add', [])
        .config(config);

    config.$inject = ['$stateProvider', '$urlRouterProvider'];
    function config($stateProvider, $urlRouterProvider) {

        $stateProvider
            .state('main.event.add', {
                url: '/add',
                views: {
                    '@main': {
                        templateUrl: '../views/event/event.profile.html',
                        controller: 'EventAddCtrl as vm'
                    }
                },
                data: {
                    is_granted: ['ROLE_USER']
                }
            });
    }

})();

(function () {
    'use strict';

    angular
        .module('main')
        .controller('EventFeedCtrl', EventFeedCtrl);

    function EventFeedCtrl(EventService, Notification, $log, DEFAULT_EVENT_IMAGE) {
        var vm = this;

        vm.getEvents = getEvents;
        vm.removeEvent = removeEvent;
        vm.DEFAULT_EVENT_IMAGE = DEFAULT_EVENT_IMAGE;

        function getEvents() {
            function success(response) {
                $log.info(response);
                vm.events = response.data.objects;
            }

            function failed(response) {
                $log.error(response);
            }

            EventService
                .getEvents()
                .then(success, failed);
        }

        function removeEvent(slug) {
            function success(response) {
                $log.info(response);

                Notification.success('Deleted');
            }

            function failed(response) {
                Notification.error(response.data.message);

                $log.error(response);
            }



            EventService
                .removeEvent(slug)
                .then(success, failed);
        }
    }
})();

(function () {
    'use strict';

    angular
        .module('event.feed', [])
        .config(config);

    config.$inject = ['$stateProvider', '$urlRouterProvider'];
    function config($stateProvider, $urlRouterProvider) {

        $stateProvider
            .state('main.event.feed', {
                url: '/feed',
                views: {
                    '@main': {
                        templateUrl: '../views/event/event.feed.html',
                        controller: 'EventFeedCtrl as vm'
                    }
                },
                data: {
                    is_granted: ['ROLE_USER']
                }
            });
    }

})();

(function () {
    'use strict';

    angular
        .module('main')
        .controller('EventProfileCtrl', EventProfileCtrl);

    function EventProfileCtrl($stateParams, EventService, Notification, $log, $scope, MEDIA_URL, $rootScope, DEFAULT_EVENT_IMAGE) {
        var vm = this;

        vm.getEvent = getEvent;
        vm.updateEvent = updateEvent;
        vm.cancelUpload = cancelUpload;
        vm.upload = upload;

        vm.dateBeginPicker = false;
        vm.dateEndPicker = false;
        vm.contentEditor = false;
        vm.uploadProgress = 0;

        vm.event = {};
        vm.flow = {};
        vm.background = {};

        vm.flowConfig = {
            target: MEDIA_URL,
            singleFile: true
        };

        function getEvent() {
            function success(response) {
                $log.info(response);

                vm.event = response.data.object;

                vm.event.metafields[1].value = new Date(response.data.object.metadata.date_begin);
                vm.event.metafields[2].value = new Date(response.data.object.metadata.date_end);

                vm.contentEditor = !vm.event.content;

                vm.background = {
                    'background-image': 'url(' + (vm.event.metafields[0].value ? vm.event.metafields[0].url : DEFAULT_EVENT_IMAGE) + ')'
                };

                // vm.event.content = $sce.trustAsHtml(response.data.object.content);
            }

            function failed(response) {
                $log.error(response);
            }

            EventService
                .getEventById($stateParams.slug)
                .then(success, failed);
        }

        function updateEvent(event) {
            function success(response) {
                $log.info(response);

                Notification.primary(
                    {
                        message: 'Saved',
                        delay: 800,
                        replaceMessage: true
                    }
                );
            }

            function failed(response) {
                $log.error(response);
            }

            if ($rootScope.globals.currentUser._id === event.metadata.user._id)
                EventService
                    .updateEvent(event)
                    .then(success, failed);
            else
                Notification.warning("You can't update");
        }

        function cancelUpload() {
            vm.flow.cancel();
            vm.background = {
                'background-image': 'url(' + (vm.event.metafields[0].value ? vm.event.metafields[0].url : DEFAULT_EVENT_IMAGE) + ')'
            };
        }

        $scope.$watch('vm.flow.files[0].file.name', function () {
            if (!vm.flow.files[0]) {
                return ;
            }
            var fileReader = new FileReader();
            fileReader.readAsDataURL(vm.flow.files[0].file);
            fileReader.onload = function (event) {
                $scope.$apply(function () {
                    vm.background = {
                        'background-image': 'url(' + event.target.result + ')'
                    };
                });
            };
        });

        function upload() {

            EventService
                .upload(vm.flow.files[0].file)
                .then(function(response){

                    vm.event.metafields[0].value = response.media.name;

                    updateEvent(vm.event);
                    vm.flow.cancel();
                    vm.uploadProgress = 0;

                }, function(){
                    console.log('failed :(');
                }, function(progress){
                    vm.uploadProgress = progress;
                });

        }

    }
})();

(function () {
    'use strict';

    angular
        .module('event.profile', [])
        .config(config);

    config.$inject = ['$stateProvider', '$urlRouterProvider'];
    function config($stateProvider, $urlRouterProvider) {

        $stateProvider
            .state('main.event.profile', {
                url: '/slugs/:slug',
                views: {
                    '@main': {
                        templateUrl: '../views/event/event.profile.html',
                        controller: 'EventProfileCtrl as vm'
                    }
                },
                data: {
                    is_granted: ['ROLE_USER']
                }
            });
    }

})();

(function () {
    'use strict';

    angular
        .module('main')
        .controller('UserProfileCtrl', UserProfileCtrl);

    function UserProfileCtrl(UserService, $stateParams, EventService, Notification, $log, MEDIA_URL, $state, DEFAULT_EVENT_IMAGE) {
        var vm = this;

        vm.getUser = getUser;
        vm.updateUser = updateUser;
        vm.cancelUpload = cancelUpload;
        vm.upload = upload;

        vm.DEFAULT_EVENT_IMAGE = DEFAULT_EVENT_IMAGE;

        vm.user = {};
        vm.flow = {};

        vm.uploadProgress = 0;

        vm.flowConfig = {
            target: MEDIA_URL,
            singleFile: true
        };

        vm.avatar = null;

        function getUser() {
            function success(response) {
                $log.info(response);

                vm.user = response.data.object;

                vm.avatar = response.data.object.metadata.image.url;

                getEvents(vm.user.metadata.username);

            }

            function failed(response) {
                $log.error(response);
            }

            if ($state.is('main.user.myProfile'))
                UserService
                    .getCurrentUser()
                    .then(success, failed);
            else
                UserService
                    .getUser($stateParams.slug)
                    .then(success, failed);
        }

        function updateUser(user) {
            function success(response) {
                $log.info(response);

                Notification.primary(
                    {
                        message: 'Saved',
                        delay: 800,
                        replaceMessage: true
                    }
                );
            }

            function failed(response) {
                $log.error(response);
            }

            UserService
                .updateUser(user)
                .then(success, failed);
        }

        function getEvents(username) {
            function success(response) {
                $log.info(response);

                vm.events = response.data.objects;
            }

            function failed(response) {
                $log.error(response);
            }
            console.log(username);

            EventService
                .getEventsByUsername(username, true)
                .then(success, failed);
        }

        function cancelUpload() {
            vm.flow.cancel();
        }

        function upload() {

            EventService
                .upload(vm.flow.files[0].file)
                .then(function(response){

                    vm.user.metafields[4].value = response.media.name;
                    vm.avatar = response.media.url;

                    updateUser(vm.user);
                    vm.flow.cancel();
                    vm.uploadProgress = 0;

                }, function(){
                    console.log('failed :(');
                }, function(progress){
                    vm.uploadProgress = progress;
                });

        }

    }
})();

(function () {
    'use strict';

    angular
        .module('user.profile', [])
        .config(config);

    config.$inject = ['$stateProvider', '$urlRouterProvider'];
    function config($stateProvider, $urlRouterProvider) {

        $stateProvider
            .state('main.user.profile', {
                url: '/profile/:slug',
                views: {
                    '@main': {
                        templateUrl: '../views/user/user.profile.html',
                        controller: 'UserProfileCtrl as vm'
                    }
                },
                data: {
                    is_granted: ['ROLE_USER']
                }
            })
            .state('main.user.myProfile', {
                url: '/my-profile',
                views: {
                    '@main': {
                        templateUrl: '../views/user/user.profile.html',
                        controller: 'UserProfileCtrl as vm'
                    }
                },
                data: {
                    is_granted: ['ROLE_USER']
                }
            });
    }

})();

(function () {
    'use strict';

    angular
        .module('main')
        .controller('UserSettingsCtrl', UserSettingsCtrl);

    function UserSettingsCtrl(UserService, EventService, Notification, $log, MEDIA_URL, DEFAULT_EVENT_IMAGE) {
        var vm = this;

        vm.getUser = getUser;
        vm.updateUser = updateUser;
        vm.cancelUpload = cancelUpload;
        vm.upload = upload;

        vm.DEFAULT_EVENT_IMAGE = DEFAULT_EVENT_IMAGE;

        vm.flow = {};
        vm.user = {};

        vm.uploadProgress = 0;

        vm.flowConfig = {
            target: MEDIA_URL,
            singleFile: true
        };

        vm.avatar = null;
        vm.settingsForm = null;

        function getUser() {
            function success(response) {
                $log.info(response);

                vm.user = response.data.object;

                vm.avatar = response.data.object.metadata.image.url;

            }

            function failed(response) {
                $log.error(response);
            }

            UserService
                .getCurrentUser()
                .then(success, failed);
        }


        function updateUser(user) {
            function success(response) {
                $log.info(response);

                Notification.primary(
                    {
                        message: 'Saved',
                        delay: 800,
                        replaceMessage: true
                    }
                );
            }

            function failed(response) {
                $log.error(response);
            }

            if (vm.flow.files[0])
                upload();
            else
                if (vm.settingsForm.$valid)
                    UserService
                        .updateUser(user)
                        .then(success, failed);
            }


        function cancelUpload() {
            vm.flow.cancel();
        }

        function upload() {
            if (vm.settingsForm.$valid)
                EventService
                    .upload(vm.flow.files[0].file)
                    .then(function(response){

                        vm.user.metafields[4].value = response.media.name;
                        vm.avatar = response.media.url;

                        updateUser(vm.user);

                        vm.flow.cancel();
                        vm.uploadProgress = 0;

                    }, function(){
                        console.log('failed :(');
                    }, function(progress){
                        vm.uploadProgress = progress;
                    });
            else
                Notification.error('Incorrect values!');

        }

    }
})();

(function () {
    'use strict';

    angular
        .module('user.settings', [])
        .config(config);

    config.$inject = ['$stateProvider', '$urlRouterProvider'];
    function config($stateProvider, $urlRouterProvider) {

        $stateProvider
            .state('main.user.settings', {
                url: '/settings',
                views: {
                    '@main': {
                        templateUrl: '../views/user/user.settings.html',
                        controller: 'UserSettingsCtrl as vm'
                    }
                },
                data: {
                    is_granted: ['ROLE_USER']
                }
            });
    }

})();
