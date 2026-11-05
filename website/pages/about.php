<?php
current_page('about');
site_head(setting('about_title'), excerpt(setting('about_text'), 160), setting('about_image'));
echo '<div class="page-top-space"></div>';
sec_about(false);
sec_stats();
sec_clients();
site_foot();
