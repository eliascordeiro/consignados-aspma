<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
include(__DIR__ . '/nusoap.php');

// LOG: Captura IP de origem
$origem_ip = $_SERVER['REMOTE_ADDR'] ?? 'desconhecido';
$origem_forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? 'nenhum';
error_log("[ZETRA PHP] Chamada recebida de IP: $origem_ip (X-Forwarded-For: $origem_forwarded)");

$cliente    = $_POST['cliente'];
$convenio   = $_POST['convenio'];
$usuario    =  $_POST['usuario'];
$senha      = $_POST['senha'];
$matricula  = $_POST['matricula'];
$cpf        = $_POST['cpf'];
$valorParcela = $_POST['valorParcela'];

// LOG: Parâmetros recebidos
error_log("[ZETRA PHP] Parâmetros: cliente=$cliente, convenio=$convenio, matricula=$matricula, cpf=$cpf, valorParcela=$valorParcela");
//$matriculaMultipla = true;

//$endpoint = 'https://www.econsig.com.br/central_homologa/services/HostaHostService?wsdl';

$endpoint = 'https://api.econsig.com.br/central/services/HostaHostService?wsdl';
$client = new nusoap_client($endpoint, true);
$client->loadWSDL();
$client->operations = array_map(function ($elem) use ($endpoint) {
    $elem["endpoint"] = $endpoint;
    return $elem;
}, $client->operations);

if ($client) {
    error_log("[ZETRA PHP] Chamando consultarMargem no ZETRA...");
    
    $result = $client->call("consultarMargem", array(
        'cliente'   => $cliente,
        'convenio'  => $convenio,
        'usuario'   => $usuario,
        'senha'     => $senha,
        'matricula'     => $matricula,
        'cpf'           => $cpf,
        'valorParcela'  => $valorParcela
    ));
    
    // LOG: SOAP Request enviado
    error_log("[ZETRA PHP] SOAP Request:\n" . $client->request);
    
    // LOG: SOAP Response recebido
    error_log("[ZETRA PHP] SOAP Response:\n" . $client->response);
    
    // LOG: Erro do cliente se houver
    if ($client->getError()) {
        error_log("[ZETRA PHP] Erro NuSOAP: " . $client->getError());
    }
}

//'senhaServidor' => $senhaServidor

$string = $client->responseData;
$string =  html_entity_decode($string);

// LOG: Resposta final antes de enviar
error_log("[ZETRA PHP] Resposta final (primeiros 500 chars): " . substr($string, 0, 500));

echo $string;