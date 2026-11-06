<?php
/* Homepage: hero, then a short preview of each section (each links to its own page) */
current_page('home');
site_head();
sec_hero();
sec_stats();
sec_about(true);
sec_services(true);
sec_works(true);
sec_partners();
sec_prompts(true);
sec_store_preview();
sec_clients();
sec_blog(true);
sec_contact(true);
site_foot();
