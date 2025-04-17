/**
 * Created by alexboyce on 4/13/16.
 */

// Theme switching functionality
function setTheme(themeName) {
    localStorage.setItem('theme', themeName);
    document.documentElement.setAttribute('data-theme', themeName);
}

// Initialize theme from localStorage or default to 'oerschema'
(function() {
    const savedTheme = localStorage.getItem('theme') || 'oerschema';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

angular.module('oerschemaApp', [])
    .controller('mainCtrl', ['$scope', function($scope) {

    }]);