"use strict";
angular.module('gists', [])
    .controller('gistCtrl', ['$scope', 'userService', '$location', 'gists', 'gistService',
        function (scope, userService, loc, gists, gistService) {
            scope.data = {};

            if (userService.hasGistRepo()) {
                loc.path('/login');
            }

            var updateSuccess = function (d) {
                    scope.refresh();
                },
                updateFail = function (e) {
                    scope.data.error = "Could not update gist";
                };


            scope.logout = function () {
                if (userService.logout()) {
                    loc.path('/login');
                }
            };

            scope.refresh = function () {
                gistService.gists().then(function (updatedGists) {
                    scope.data.gists = updatedGists;
                });
            }

            scope.update = function (gist) {
                gistService.update(gist.id, gistService.transformForUpdate(gist))
                    .then(updateSuccess, updateFail);
            };

            scope.data.gists = gists;
        }])
    .factory('gistService', ['$http', '$q', '$rootScope', '$log', 'userService', 'Restangular', function (http, q, root, log, userService, Restangular) {
        var userGists = function () {
                var defer = q.defer();
                http.get('https://api.github.com/users/' + root.username + '/gists',
                    {
                        headers: userService.getAuthHeader()
                    })
                    .success(function (gistsData) {
                        defer.resolve(gistsData);
                    })
                    .error(function (error) {
                        defer.reject(error);
                    });
                return defer.promise;
            },
            userGistsById = function (gists) {
                var defer = q.defer(),
                    gistsWithContent = [];
                // Fetch each gist to get file content
                angular.forEach(gists, function (gist) {
                    http.get('https://api.github.com/gists/' + gist.id,
                        {
                            headers: userService.getAuthHeader()
                        })
                        .success(function (gist) {
                            gistsWithContent.push(gist);
                        })
                        .error(function (error) {
                            log.error(error);
                        });
                });
                defer.resolve(gistsWithContent);
                return defer.promise;
            }

        return {
            gists: function () {
                return userGists().then(userGistsById);
            },
            transformForUpdate: function (gist) {
                var updatedFiles = {};
                angular.forEach(gist.files, function (file) {
                    updatedFiles[file.filename] = {'content': file.content};
                });

                return {
                    description: gist.description,
                    files: updatedFiles
                };
            },
            update: function (id, updatedGist) {
                //Use restangular - ngResource cant handle PATCH method
                var gist = Restangular.one('gists', id);
                return gist.patch(JSON.stringify(updatedGist), {}, userService.getAuthHeader());
            }
        }
    }])
    .directive('gist', function () {
        return {
            restrict: 'E',
            transclude: true,
            replace: true,
            scope: {
                user: '=',
                id: '='
            },
            templateUrl: 'app/gist/gist-tab.tpl.html',
            controller: function ($scope) {
                var panes = $scope.panes = [];

                $scope.select = function (pane) {
                    angular.forEach(panes, function (pane) {
                        pane.selected = false;
                    });
                    pane.selected = true;
                };

                this.addPane = function (pane) {
                    if (panes.length == 0) {
                        $scope.select(pane);
                    }
                    panes.push(pane);
                };
            }
        };
    })
    .directive('gistFilePane', function () {
        return {
            require: '^gist',
            restrict: 'E',
            replace: true,
            transclude: true,
            scope: {
                title: '='
            },
            templateUrl: 'app/gist/gist-pane.tpl.html',
            link: function (scope, element, attrs, gistCtrl) {
                gistCtrl.addPane(scope);
            }
        };
    })
    .directive('gistContent', [function () {
        return {
            restrict: 'A',
            link: function (scope, elem, attrs) {
                var textarea = elem[0],
                    orgHeight,
                    ngTextarea = angular.element(textarea);

                ngTextarea.on("focus", function (e) {
                    var target = e.target;
                    orgHeight = target.clientHeight + 'px';
                    target.style.height = target.scrollHeight + 'px';

                    target.select();
                    //handle browser behaviour
                    target.onmouseup = function () {
                        target.onmouseup = null;
                        return false;
                    }
                });

                ngTextarea.on('blur', function (e) {
                    e.target.style.height = orgHeight || '100px';
                });
            }
        };
    }]);