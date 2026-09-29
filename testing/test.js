import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 10,
  duration: '10m',
};

export default function() {
  let res = http.get('https://quickpizza.grafana.com');
  check(res, { "status is 200": (res) => res.status === 200 });
  sleep(1);
}

// export K6_PROMETHEUS_RW_SERVER_URL="http://16.112.122.201:9090/api/v1/write"
// export K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM=true
// k6 run script.js