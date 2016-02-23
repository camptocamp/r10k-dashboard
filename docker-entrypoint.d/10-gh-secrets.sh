#!/bin/bash

if test -n "${CLIENT_ID}"; then
  mkdir -p /var/www/html/r10k-dashboard/auth/
  sed -e "s/YOUR_CLIENT_ID/${CLIENT_ID}/;s/YOUR_CLIENT_SECRET/${CLIENT_SECRET}/" \
    /var/www/html/r10k-dashboard/auth.php /var/www/html/r10k-dashboard/auth/index.php
  sed -i "s/YOUR_CLIENT_ID/${CLIENT_ID}/" /var/www/html/r10k-dashboard/index.html
fi
