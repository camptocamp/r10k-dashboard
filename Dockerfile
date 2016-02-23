FROM nginx

MAINTAINER raphael.pinson@camptocamp.com


COPY html /usr/share/nginx/html/r10k-dashboard
COPY docker-entrypoint.d /
COPY docker-entrypoint.sh /

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
