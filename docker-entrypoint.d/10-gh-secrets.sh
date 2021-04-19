#!/bin/bash

if test -n "${CLIENT_ID}"; then
  mkdir -p /var/www/html/auth/
  sed -e "s/YOUR_CLIENT_ID/${CLIENT_ID}/;s/YOUR_CLIENT_SECRET/${CLIENT_SECRET}/" \
    /var/www/html/auth.php > /var/www/html/auth/index.php
  sed -i "s/YOUR_CLIENT_ID/${CLIENT_ID}/" /var/www/html/index.html
fi
