<?php
current_page('blog');
site_head(setting('blog_title'), setting('blog_subtitle'));
page_header('blog');
sec_blog(false);
site_foot();
