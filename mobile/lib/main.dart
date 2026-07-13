import 'package:flutter/material';

void main() {
  runApp(const BhusawalConnectApp());
}

class BhusawalConnectApp extends StatelessWidget {
  const BhusawalConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Bhusawal Connect',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFB02F00), // Bhusawal Connect Brand Primary
          primary: const Color(0xFFB02F00),
          secondary: const Color(0xFF5F5E5E),
        ),
        useMaterial3: true,
        fontFamily: 'Plus Jakarta Sans',
      ),
      home: const RoleSelectionScreen(),
    );
  }
}

class RoleSelectionScreen extends StatelessWidget {
  const RoleSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Bhusawal Connect',
          style: TextStyle(fontWeight: FontWeight.extrabold, italic: true),
        ),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Select Portal Role',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Choose a dashboard to enter the hyperlocal super-app ecosystem.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 32),
            _buildRoleButton(
              context,
              title: '📱 Customer Portal',
              subtitle: 'Order groceries, food, medicines or book auto-rickshaw',
              color: Colors.deepOrange.shade50,
              textColor: Colors.deepOrange.shade900,
            ),
            const SizedBox(height: 16),
            _buildRoleButton(
              context,
              title: '🏪 Merchant Console',
              subtitle: 'Manage listings, view store metrics, approve orders',
              color: Colors.orange.shade50,
              textColor: Colors.orange.shade900,
            ),
            const SizedBox(height: 16),
            _buildRoleButton(
              context,
              title: '🛵 Rider Dashboard',
              subtitle: 'Accept active trip requests and view live routes',
              color: Colors.green.shade50,
              textColor: Colors.green.shade900,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoleButton(
    BuildContext context, {
    required String title,
    required String subtitle,
    required Color color,
    required Color textColor,
  }) {
    return InkWell(
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Entering $title...')),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: textColor.withOpacity(0.15), width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: textColor),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(fontSize: 12, color: textColor.withOpacity(0.8)),
            ),
          ],
        ),
      ),
    );
  }
}
