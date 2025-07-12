export type ResponseAudioTranscriptDelta = {
  event_id: string;
  type: 'response.audio_transcript.delta';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string; // Partial audio transcript delta
};

export type ConversationItemInputAudioTranscriptionDelta = {
  event_id: string;
  type: 'conversation.item.input_audio_transcription.delta';
  item_id: string;
  content_index: number;
  delta: string; // Partial transcription delta
};
