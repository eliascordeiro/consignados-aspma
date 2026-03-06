<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: text/plain; charset=UTF-8");

// Consulta serviço externo para descobrir IP público do Railway
$ip = @file_get_contents('https://api.ipify.org');

if ($ip) {
    echo "IP DE SAÍDA DO RAILWAY:\n";
    echo "=======================\n\n";
    echo $ip . "\n\n";
    echo "Este é o IP que a Zetra/eConsig vê nas requisições.\n";
    echo "Solicite à Zetra para LIBERAR este IP na whitelist.\n";
} else {
    echo "Erro ao consultar IP externo\n";
}
?>
