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
