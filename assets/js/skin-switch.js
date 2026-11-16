$(function() {
    $('#change-skin').on('click', function (e) {
      $("body").toggleClass("page-dark-mode");
      // A real click (not the restore below): show the chosen mode until the pointer leaves.
      if (e.originalEvent) $(this).addClass('is-switched');
      localStorage.setItem('bj-dark-mode', $("body").hasClass("page-dark-mode"));
      BeautifulJekyllJS.initNavbar();
    });
    $('#change-skin').on('mouseleave', function () {
      $(this).removeClass('is-switched');
    });
    if (localStorage.getItem('bj-dark-mode') === 'true') {
      $('#change-skin').trigger('click');
    }
  });
  