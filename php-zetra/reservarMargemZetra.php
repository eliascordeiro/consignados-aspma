<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
include(__DIR__ . '/nusoap.php');

$cliente    = $_POST['cliente'];
$convenio   = $_POST['convenio'];
$usuario    = $_POST['usuario'];
$senha      = $_POST['senha'];
$matricula   = $_POST['matricula'];
$cpf         = $_POST['cpf'];
$valorParcela  = $_POST['valorParcela'];
$valorLiberado = $_POST['valorLiberado'];
$servicoCodigo = $_POST['servicoCodigo'];
$prazo    = $_POST['prazo'];
$codVerba = $_POST['codVerba'];
$adeIdentificador = $_POST['adeIdentificador'];

//$endpoint = 'https://www.econsig.com.br/central_homologa/services/HostaHostService?wsdl';

$endpoint = 'https://api.econsig.com.br/central/services/HostaHostService?wsdl';
$client = new nusoap_client($endpoint, true);
$client->loadWSDL();
$client->operations = array_map(function ($elem) use ($endpoint) {
    $elem["endpoint"] = $endpoint;
    return $elem;
}, $client->operations);

if ($client) {
    $result = $client->call("reservarMargem", array(
        'cliente'       => $cliente,
        'convenio'      => $convenio,
        'usuario'       => $usuario,
        'senha'         => $senha,
        'matricula'     => $matricula,
        'cpf'           => $cpf,
        'valorParcela'  => $valorParcela,
        'valorLiberado' => $valorLiberado,
        'servicoCodigo' => $servicoCodigo,
        'prazo'         => $prazo,
        'codVerba'      => $codVerba,
        'adeIdentificador' => $adeIdentificador
    ));
}

$string = $client->responseData;
$string =  html_entity_decode($string);
echo $string;
