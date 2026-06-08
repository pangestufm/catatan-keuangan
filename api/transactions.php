<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-App-Token, X-App-Workspace');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$configPath = __DIR__ . '/config.php';
$accessToken = '';
if (is_file($configPath)) {
    $config = require $configPath;
    if (is_array($config) && isset($config['access_token'])) {
        $accessToken = (string) $config['access_token'];
    }
}

if ($accessToken !== '') {
    $providedToken = $_SERVER['HTTP_X_APP_TOKEN'] ?? '';
    if (!hash_equals($accessToken, $providedToken)) {
        respond(['error' => 'Unauthorized'], 401);
    }
}

try {
    $pdo = openDatabase();
    $method = $_SERVER['REQUEST_METHOD'];
    $workspaceId = sanitizeWorkspace($_SERVER['HTTP_X_APP_WORKSPACE'] ?? '');

    if ($workspaceId === '') {
        respond(['error' => 'Workspace wajib diisi.'], 422);
    }
    $stateKey = 'transactions:' . $workspaceId;

    if ($method === 'GET') {
        respond(readState($pdo, $stateKey));
    }

    if ($method === 'DELETE') {
        writeState($pdo, $stateKey, []);
        respond(['transactions' => [], 'updatedAt' => gmdate(DATE_ATOM)]);
    }

    if ($method === 'PUT' || $method === 'POST') {
        $payload = json_decode(file_get_contents('php://input') ?: '', true);
        if (!is_array($payload) || !isset($payload['transactions']) || !is_array($payload['transactions'])) {
            respond(['error' => 'Payload harus berisi transactions array.'], 422);
        }

        $transactions = sanitizeTransactions($payload['transactions']);
        writeState($pdo, $stateKey, $transactions);
        respond(['transactions' => $transactions, 'updatedAt' => gmdate(DATE_ATOM)]);
    }

    respond(['error' => 'Method not allowed'], 405);
} catch (Throwable $error) {
    respond(['error' => 'Server error', 'message' => $error->getMessage()], 500);
}

function openDatabase(): PDO
{
    $dataDir = __DIR__ . '/data';
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
    }

    $pdo = new PDO('sqlite:' . $dataDir . '/catatan-keuangan.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS app_state (
            state_key TEXT PRIMARY KEY,
            state_value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )'
    );

    return $pdo;
}

function readState(PDO $pdo, string $stateKey): array
{
    $statement = $pdo->prepare('SELECT state_value, updated_at FROM app_state WHERE state_key = :state_key');
    $statement->execute(['state_key' => $stateKey]);
    $row = $statement->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return ['transactions' => [], 'updatedAt' => null];
    }

    $transactions = json_decode((string) $row['state_value'], true);
    return [
        'transactions' => is_array($transactions) ? sanitizeTransactions($transactions) : [],
        'updatedAt' => $row['updated_at'],
    ];
}

function writeState(PDO $pdo, string $stateKey, array $transactions): void
{
    $statement = $pdo->prepare(
        'INSERT OR REPLACE INTO app_state (state_key, state_value, updated_at)
         VALUES (:state_key, :state_value, :updated_at)'
    );
    $statement->execute([
        'state_key' => $stateKey,
        'state_value' => json_encode(array_values($transactions), JSON_UNESCAPED_UNICODE),
        'updated_at' => gmdate(DATE_ATOM),
    ]);
}

function sanitizeTransactions(array $transactions): array
{
    $clean = [];
    foreach ($transactions as $transaction) {
        if (!is_array($transaction)) {
            continue;
        }

        $type = $transaction['type'] ?? '';
        if ($type !== 'income' && $type !== 'expense') {
            continue;
        }

        $amount = (float) ($transaction['amount'] ?? 0);
        if ($amount <= 0) {
            continue;
        }

        $clean[] = [
            'id' => cleanString($transaction['id'] ?? bin2hex(random_bytes(12))),
            'date' => cleanString($transaction['date'] ?? ''),
            'type' => $type,
            'category' => cleanString($transaction['category'] ?? 'Lainnya'),
            'description' => cleanString($transaction['description'] ?? ''),
            'amount' => (int) round($amount),
            'source' => cleanString($transaction['source'] ?? 'Online'),
            'createdAt' => cleanString($transaction['createdAt'] ?? gmdate(DATE_ATOM)),
        ];
    }

    return $clean;
}

function cleanString($value): string
{
    return trim((string) $value);
}

function sanitizeWorkspace($value): string
{
    $workspace = strtolower(cleanString($value));
    $workspace = preg_replace('/[^a-z0-9_-]+/', '-', $workspace);
    $workspace = trim((string) $workspace, '-');
    return substr($workspace, 0, 48);
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}
