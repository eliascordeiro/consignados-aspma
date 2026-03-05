<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
include(__DIR__ . '/nusoap.php');

$cliente    = $_POST['cliente'];
$convenio   = $_POST['convenio'];
$usuario    = $_POST['usuario'];
$senha      = $_POST['senha'];
$valorParcela  = $_POST['valorParcela'];
$valorLiberado = $_POST['valorLiberado'];
$prazo    = $_POST['prazo'];
$adeIdentificador = $_POST['adeIdentificador'];

$endpoint = 'https://api.econsig.com.br/central/services/HostaHostService?wsdl';

$client = new nusoap_client($endpoint, true);
$client->loadWSDL();
$client->operations = array_map(function ($elem) use ($endpoint) {
    $elem["endpoint"] = $endpoint;
    return $elem;
}, $client->operations);

if ($client) {
    $result = $client->call("alterarConsignacao", array(
        'cliente'       => $cliente,
        'convenio'      => $convenio,
        'usuario'       => $usuario,
        'senha'         => $senha,
        'valorParcela'  => $valorParcela,
        'valorLiberado' => $valorLiberado,
        'prazo'         => $prazo,
        'adeIdentificador' => $adeIdentificador
    ));
}

$string = $client->responseData;
$string =  html_entity_decode($string);
echo $string;