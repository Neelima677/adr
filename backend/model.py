import torch
import torch.nn as nn
from transformers import AutoModel


class AttentionLayer(nn.Module):
    def __init__(self, hidden_dim):
        super().__init__()
        self.attn = nn.Linear(hidden_dim * 2, 1)

    def forward(self, lstm_out, mask):
        scores = self.attn(lstm_out).squeeze(-1)

        if scores.dtype == torch.float16:
            scores = scores.masked_fill(mask == 0, -10000.0)
        else:
            scores = scores.masked_fill(mask == 0, -1e9)

        weights = torch.softmax(scores, dim=1)
        context = torch.sum(lstm_out * weights.unsqueeze(-1), dim=1)
        return context, weights


class BioClinicalBERT_BiLSTM_Attention(nn.Module):
    def __init__(self, model_name, lstm_hidden=128, dropout=0.3):
        super().__init__()

        self.bert = AutoModel.from_pretrained(model_name)
        bert_hidden = self.bert.config.hidden_size

        self.lstm = nn.LSTM(
            input_size=bert_hidden,
            hidden_size=lstm_hidden,
            num_layers=1,
            batch_first=True,
            bidirectional=True
        )

        self.attention = AttentionLayer(lstm_hidden)
        self.dropout = nn.Dropout(dropout)

        self.sentiment_head = nn.Linear(lstm_hidden * 2, 3)
        self.adr_head = nn.Linear(lstm_hidden * 2, 1)

    def forward(self, input_ids, attention_mask):
        bert_out = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        seq_output = bert_out.last_hidden_state

        lstm_out, _ = self.lstm(seq_output)
        context, attn_weights = self.attention(lstm_out, attention_mask)
        context = self.dropout(context)

        sentiment_logits = self.sentiment_head(context)
        adr_logits = self.adr_head(context).squeeze(-1)

        return sentiment_logits, adr_logits, attn_weights