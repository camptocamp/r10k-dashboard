#!/bin/bash

if test -n "${CLIENT_ID}"; then
  mkdir -p /usr/share/nginx/html/r10k-dashboard/auth/
  sed -e "s/YOUR_CLIENT_ID/${CLIENT_ID}/;s/YOUR_CLIENT_SECRET/${CLIENT_SECRET}/" \
    /usr/share/nginx/html/r10k-dashboard/auth.php /usr/share/nginx/html/r10k-dashboard/auth/index.php
fi
