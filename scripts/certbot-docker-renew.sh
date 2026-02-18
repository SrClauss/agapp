#!/bin/sh
# Renew certs using certbot container with webroot, then reload nginx container
/usr/bin/docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v /srv/agapp/certbot/www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot || exit 1
# reload nginx to pick up new certs
if /usr/bin/docker ps --format '{{.Names}}' | /bin/grep -q 'agiliza_nginx'; then
  /usr/bin/docker exec agiliza_nginx nginx -s reload || true
fi
