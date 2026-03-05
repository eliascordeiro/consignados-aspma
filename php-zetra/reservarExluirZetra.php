<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
include(__DIR__ . '/nusoap.php');

$cliente    = $_POST['cliente'];
$convenio   = $_POST['convenio'];
$usuario    = $_POST['usuario'];
$senha      = $_POST['senha'];
$adeIdentificador = $_POST['adeIdentificador'];
$obsMotivoOperacao = $_POST['obsMotivoOperacao'];
$codigoMotivoOperacao = $_POST['codigoMotivoOperacao'];

//$endpoint = 'https://www.econsig.com.br/central_homologa/services/HostaHostService?wsdl';


$endpoint = 'https://api.econsig.com.br/central/services/HostaHostService?wsdl';
$client = new nusoap_client($endpoint, true);
$client->loadWSDL();
$client->operations = array_map(function ($elem) use ($endpoint) {
    $elem["endpoint"] = $endpoint;
    return $elem;
}, $client->operations);

if ($client) {
    $result = $client->call("liquidarConsignacao", array(
        'cliente'       => $cliente,
        'convenio'      => $convenio,
        'usuario'       => $usuario,
        'senha'         => $senha,
        'adeIdentificador' => $adeIdentificador,
        'obsMotivoOperacao' => $obsMotivoOperacao,
        'codigoMotivoOperacao' => $codigoMotivoOperacao
    ));
}

$string = $client->responseData;
$string =  html_entity_decode($string);
echo $string;