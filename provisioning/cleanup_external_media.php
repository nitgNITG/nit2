<?php
// ============================================================================
//  cleanup_external_media.php — delete this academy's videos from the SHARED
//  external providers (VDOCipher, Vimeo) before the academy is torn down, so we
//  don't leak paid storage in NIT's shared accounts.
//
//  Run INSIDE the academy container by destroy.sh, BEFORE the DB is dropped and
//  BEFORE the container is removed (it needs Moodle's DB + plugin config):
//     docker exec <container> php /var/www/moodledata/cleanup_external_media.php
//
//  Best-effort by design: any missing table, missing credential, or API error is
//  logged and skipped — media cleanup must never block or fail the teardown.
//  Video ids come from the per-provider registries the plugins maintain:
//    local_vdocipher_videos.videoid   +  local_vdocipher/apisecret
//    local_vimeo_videos.videoid       +  local_vimeo/access_token
// ============================================================================
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');

global $DB;

/** Small curl wrapper. Returns [http_code, body]; never throws. */
function cem_http(string $method, string $url, array $headers): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 8,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($body === false) {
        $body = 'curl error: ' . curl_error($ch);
    }
    curl_close($ch);
    return [$code, (string) $body];
}

/** Distinct, non-empty video ids from a registry table (returns [] if absent). */
function cem_ids(string $table): array {
    global $DB;
    try {
        if (!$DB->get_manager()->table_exists($table)) {
            return [];
        }
        $ids = $DB->get_fieldset_select($table, 'videoid', "videoid IS NOT NULL AND videoid <> ''");
        return array_values(array_unique(array_filter(array_map('strval', $ids ?: []))));
    } catch (\Throwable $e) {
        fwrite(STDERR, "read $table failed: " . $e->getMessage() . "\n");
        return [];
    }
}

$report = ['vdocipher' => 0, 'vimeo' => 0];

// ── VDOCipher: DELETE /api/videos/?videos=id1,id2  (Authorization: Apisecret …) ─
$vdsecret = trim((string) get_config('local_vdocipher', 'apisecret'));
$vdbase   = trim((string) get_config('local_vdocipher', 'apibase')) ?: 'https://dev.vdocipher.com/api';
$vdids    = cem_ids('local_vdocipher_videos');
if ($vdsecret !== '' && $vdids) {
    foreach (array_chunk($vdids, 20) as $chunk) {
        $url = rtrim($vdbase, '/') . '/videos?videos=' . implode(',', array_map('rawurlencode', $chunk));
        [$code, $body] = cem_http('DELETE', $url, ['Authorization: Apisecret ' . $vdsecret]);
        if ($code >= 200 && $code < 300) {
            $report['vdocipher'] += count($chunk);
        } else {
            fwrite(STDERR, "vdocipher delete http $code: " . substr($body, 0, 200) . "\n");
        }
    }
} else if ($vdids) {
    fwrite(STDERR, "vdocipher: " . count($vdids) . " videos but no apisecret — skipped\n");
}

// ── Vimeo: DELETE /videos/{id}  (Authorization: bearer …) ───────────────────
$vmtoken = trim((string) get_config('local_vimeo', 'access_token'));
$vmbase  = trim((string) get_config('local_vimeo', 'apibase')) ?: 'https://api.vimeo.com';
$vmids   = cem_ids('local_vimeo_videos');
if ($vmtoken !== '' && $vmids) {
    $headers = [
        'Authorization: bearer ' . $vmtoken,
        'Accept: application/vnd.vimeo.*+json;version=3.4',
    ];
    foreach ($vmids as $vid) {
        $url = rtrim($vmbase, '/') . '/videos/' . rawurlencode($vid);
        [$code, $body] = cem_http('DELETE', $url, $headers);
        // 204 = deleted, 404 = already gone (treat as success).
        if ($code === 204 || $code === 404) {
            $report['vimeo']++;
        } else {
            fwrite(STDERR, "vimeo delete $vid http $code: " . substr($body, 0, 200) . "\n");
        }
    }
} else if ($vmids) {
    fwrite(STDERR, "vimeo: " . count($vmids) . " videos but no access_token — skipped\n");
}

echo "external media cleanup: vdocipher={$report['vdocipher']} vimeo={$report['vimeo']}\n";
