<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Health check endpoint
if ($_SERVER['REQUEST_URI'] === '/' || $_SERVER['REQUEST_URI'] === '/health') {
    echo json_encode([
        'status' => 'ok',
        'service' => 'PHP Zetra Service',
        'version' => phpversion(),
        'endpoints' => [
            '/consultaMargemZetra.php',
            '/consultarConsignacaoZetra.php',
            '/reservarMargemZetra.php',
            '/reservarExluirZetra.php',
            '/alterarConsignacao.php'
        ]
    ]);
    exit;
}

// Redirecionar para endpoint solicitado
http_response_code(404);
echo json_encode([
    'error' => 'Endpoint não encontrado',
    'message' => 'Acesse os endpoints Zetra específicos'
]);
