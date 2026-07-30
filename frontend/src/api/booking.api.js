const API_BASE = 'http://localhost:5000/api/bookings';

export const BookingAPI = {
    async createBooking(bookingData) {
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'বুকিং সেভ করতে সমস্যা হয়েছে');
        return data;
    }
};