$(function() {
    $('#change-skin').on('click', function (e) {
      $("body").toggleClass("page-dark-mode");
      // A real click (not the restore below): show the chosen mode until the pointer leaves.
      if (e.originalEvent) $(this).addClass('is-switched');
      try { localStorage.setItem('bj-dark-mode', $("body").hasClass("page-dark-mode")); } catch (err) {}
      BeautifulJekyllJS.initNavbar();
    });
    $('#change-skin').on('mouseleave', function () {
      $(this).removeClass('is-switched');
    });
    var saved = null;
    try { saved = localStorage.getItem('bj-dark-mode'); } catch (err) {} // blocked storage throws
    if (saved === 'true') {
      $('#change-skin').trigger('click');
    }
  });
  