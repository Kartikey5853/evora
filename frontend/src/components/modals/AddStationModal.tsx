import { useState } from 'react';
import { X, MapPin, FileText } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { stationAPI } from '../../lib/api';

interface AddStationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AddStationModal = ({ isOpen, onClose, onSuccess }: AddStationModalProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    document_url: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await stationAPI.addStation({
        name: formData.name,
        address: formData.address,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        document_url: formData.document_url,
      });
      onSuccess?.();
      onClose();
      setFormData({ name: '', address: '', latitude: '', longitude: '', document_url: '' });
    } catch (error) {
      console.error('Failed to add station:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-elevated animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <MapPin className="w-5 h-5 text-primary-foreground" />
            </div>
            <h2 className="font-display font-semibold text-lg text-foreground">Add New Station</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Station Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-clean"
              placeholder="Downtown EV Hub"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input-clean"
              placeholder="123 Main Street, City"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className="input-clean"
                placeholder="19.0760"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className="input-clean"
                placeholder="72.8777"
                required
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            ⚠️ Map selection for coordinates will be handled separately
          </p>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> Proof Document URL</span>
            </label>
            <input
              type="url"
              value={formData.document_url}
              onChange={(e) => setFormData({ ...formData, document_url: e.target.value })}
              className="input-clean"
              placeholder="https://drive.google.com/file/..."
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Upload your station permit/license to Google Drive or similar and paste the link. Required for approval.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.document_url}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStationModal;
