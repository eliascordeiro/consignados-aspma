<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: text/plain; charset=UTF-8");
include(__DIR__ . '/nusoap.php');

$cliente    = 'ASPMA';
$convenio   = 'ASPMA-ARAUCARIA';
$usuario    = 'aspma_xml';
$senha      = 'dcc0bd05';
$matricula  = '222101';
$cpf        = '74517198987';
$valorParcela = '0.01';

$endpoint = 'https://api.econsig.com.br/central/services/HostaHostService?wsdl';
$client = new nusoap_client($endpoint, true);
$client->loadWSDL();
$client->operations = array_map(function ($elem) use ($endpoint) {
    $elem["endpoint"] = $endpoint;
    return $elem;
}, $client->operations);

if ($client) {
    $result = $client->call("consultarMargem", array(
        'cliente'   => $cliente,
        'convenio'  => $convenio,
        'usuario'   => $usuario,
        'senha'     => $senha,
        'matricula'     => $matricula,
        'cpf'           => $cpf,
        'valorParcela'  => $valorParcela
    ));
}

echo "==== REQUEST SOAP ====\n\n";
echo $client->request;
echo "\n\n==== RESPONSE SOAP ====\n\n";
echo $client->response;
echo "\n\n==== REQUEST HEADERS ====\n\n";
print_r($client->requestHeaders);
echo "\n\n==== RESPONSE HEADERS ====\n\n";
print_r($client->responseHeaders);
