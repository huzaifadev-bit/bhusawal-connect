import 'package:equatable/equatable';

class Product extends Equatable {
  final String id;
  final String storeId;
  final String name;
  final String? description;
  final double price;
  final String? image;

  const Product({
    required this.id,
    required this.storeId,
    required this.name,
    this.description,
    required this.price,
    this.image,
  });

  @override
  List<Object?> get props => [id, storeId, name, description, price, image];
}
