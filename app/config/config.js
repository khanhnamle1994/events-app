(function () {
    'use strict';

    var app = angular
                .module('main');

    app.constant('BUCKET_SLUG', 'your-bucket-slug');
    app.constant('URL', 'https://api.cosmicjs.com/v1/');
    app.constant('MEDIA_URL', 'https://api.cosmicjs.com/v1/your-bucket-slug/media');
    app.constant('READ_KEY', 'your-read-key');
    app.constant('WRITE_KEY', 'your-write-key');
    app.constant('DEFAULT_EVENT_IMAGE', 'url-image');

})();
