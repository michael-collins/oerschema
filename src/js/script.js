/**
 * Created by alexboyce on 4/13/16.
 */

angular.module('oerschemaApp', [])
    .controller('mainCtrl', ['$scope', function($scope) {

    }]);

// Check for format parameter in URL and redirect if needed
function handleFormatParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  const format = urlParams.get('format');
  
  if (format === 'ttl') {
    // Extract the term name from the current URL path
    const pathParts = window.location.pathname.split('/');
    const termName = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
    
    // Redirect to the .ttl file
    if (termName && termName !== '') {
      window.location.href = `/terms/${termName}.ttl`;
    }
  }
}

// Execute when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  handleFormatParameter();
});