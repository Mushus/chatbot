import { VertexAI } from '@google-cloud/vertexai/build/src/vertex_ai';
import { instance } from 'gaxios';
import { GoogleCloudLocation, GoogleCloudProject } from '../env/value';

export const vertexAI = new VertexAI({
  project: GoogleCloudProject,
  location: GoogleCloudLocation,
});

// for debug
instance.defaults.errorRedactor = (data) => {
  console.error('errorRedactor', data.config);
  console.error('errorRedactor', data.response?.data);
  return {};
};
