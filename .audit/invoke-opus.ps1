param([Parameter(Mandatory)][string]$PromptFile, [string]$OutputFile = '.audit/opus-review.json', [int]$MaxTokens = 8000)
$ErrorActionPreference = 'Stop'
$bazeSecret = Import-Clixml -LiteralPath 'C:/Users/wizju/Documents/Codex/2026-11-23/new-chat-3/work/baze-private/key.clixml'
$bazeCredential = [System.Net.NetworkCredential]::new('', $bazeSecret)
$bazeHeaders = @{ Authorization = 'Bearer ' + $bazeCredential.Password.Trim() }
try {
  $bazePayload = @{ model = 'claude-opus-5-5'; messages = @(@{ role = 'system'; content = 'You are reviewing a real repository through the Baze gateway. Use only the supplied source and test evidence. You have no direct tool access. Clearly distinguish reproduced defects, source-based findings, and unverified possibilities. Do not claim to have operated tools. Respond in Korean.' }, @{ role = 'user'; content = (Get-Content -LiteralPath $PromptFile -Raw -Encoding utf8) }); max_tokens = $MaxTokens; stream = $false } | ConvertTo-Json -Depth 8
  $bazeReply = Invoke-RestMethod -Method Post -Uri 'https://api.baze.co/v1/gateway/chat/completions/' -Headers $bazeHeaders -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($bazePayload)) -TimeoutSec 240
  if ($bazeReply.model -ne 'claude-opus-5-5') { throw 'Unexpected returned model' }
  $bazeReply | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $OutputFile -Encoding utf8
  $bazeReply | Select-Object model,choices,usage | ConvertTo-Json -Depth 30
} finally { $bazeHeaders=$null; $bazeCredential=$null; $bazeSecret=$null; $bazePayload=$null }
